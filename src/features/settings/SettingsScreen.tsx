// Design Ref: ONIGIRI SHOP redesign — 설정 화면. 무채색·플랫·타이포 중심.
// Plan SC: 일일 신규 5-50, 30 초과 시 "고강도" 경고 1회. TTS 켜기·속도.
//
// 슬라이더는 네이티브 의존성 회피 위해 스텝 버튼(−/+)으로 대체 (MVP).

import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { font, layout, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useColors, useThemedStyles } from '~/design/theme';
import { JLPT_LEVELS, type JlptLevel } from '~/types/Card';
import {
  DAILY_NEW_MAX,
  DAILY_NEW_MIN,
  HIGH_INTENSITY_THRESHOLD,
  TTS_SPEED_MAX,
  TTS_SPEED_MIN,
  isHighIntensity,
  type ThemePreference,
  useSettingsStore,
} from '~/stores/SettingsStore';
import { buildExportService } from './buildExportService';

const DAILY_STEP = 1;
const SPEED_STEP = 0.1;
const THEME_OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: 'system', label: '시스템' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
];

export default function SettingsScreen(): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const c = useColors();
  const selectedLevels = useSettingsStore((s) => s.selectedLevels);
  const dailyNewLimit = useSettingsStore((s) => s.dailyNewLimit);
  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);
  const ttsSpeed = useSettingsStore((s) => s.ttsSpeed);
  const autoPlayWordTtsOnReveal = useSettingsStore((s) => s.autoPlayWordTtsOnReveal);
  const highIntensityWarned = useSettingsStore((s) => s.highIntensityWarned);
  const themePreference = useSettingsStore((s) => s.themePreference);
  const toggleLevel = useSettingsStore((s) => s.toggleLevel);
  const setDailyNewLimit = useSettingsStore((s) => s.setDailyNewLimit);
  const setTtsEnabled = useSettingsStore((s) => s.setTtsEnabled);
  const setTtsSpeed = useSettingsStore((s) => s.setTtsSpeed);
  const setAutoPlayWordTtsOnReveal = useSettingsStore(
    (s) => s.setAutoPlayWordTtsOnReveal,
  );
  const acknowledgeHighIntensity = useSettingsStore((s) => s.acknowledgeHighIntensity);
  const setThemePreference = useSettingsStore((s) => s.setThemePreference);
  const router = useRouter();
  const [exporting, setExporting] = useState(false);

  // 학습 데이터 JSON 백업 → OS 공유 시트 (사용자 명시적 행위, 자동 송신 아님).
  const onExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const svc = await buildExportService();
      const { path, bytes } = await svc.exportToJson(true);
      await svc.shareFile(path);
      Alert.alert('백업 생성됨', `${Math.max(1, Math.round(bytes / 1024))}KB 파일을 저장/공유할 수 있어요.`);
    } catch (e) {
      Alert.alert('내보내기 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  // 한도 증가 시 고강도 진입 + 미확인이면 경고 1회.
  const changeDailyNew = (delta: number) => {
    const next = dailyNewLimit + delta;
    if (delta > 0 && isHighIntensity(next) && !highIntensityWarned) {
      Alert.alert(
        '고강도 학습',
        `하루 신규 ${HIGH_INTENSITY_THRESHOLD}개 초과는 복습 부담이 빠르게 커집니다. 계속할까요?`,
        [
          { text: '취소', style: 'cancel' },
          {
            text: '계속',
            onPress: () => {
              acknowledgeHighIntensity();
              setDailyNewLimit(next);
            },
          },
        ],
      );
      return;
    }
    setDailyNewLimit(next);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>SETTINGS</Text>

        {/* 레벨 선택 */}
        <Section title="학습 레벨" hint="최소 1개. 선택한 레벨에서 카드를 출제합니다.">
          <View style={styles.levelRow}>
            {JLPT_LEVELS.map((lv: JlptLevel) => {
              const on = selectedLevels.includes(lv);
              return (
                <Pressable
                  key={lv}
                  style={[styles.levelChip, on && styles.levelChipOn]}
                  onPress={() => toggleLevel(lv)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.levelText, on && styles.levelTextOn]}>{lv}</Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* 일일 신규 한도 */}
        <Section title="하루 새 단어" hint={`${DAILY_NEW_MIN}~${DAILY_NEW_MAX}개`}>
          <Stepper
            value={`${dailyNewLimit}개`}
            onMinus={() => changeDailyNew(-DAILY_STEP)}
            onPlus={() => changeDailyNew(DAILY_STEP)}
            minusDisabled={dailyNewLimit <= DAILY_NEW_MIN}
            plusDisabled={dailyNewLimit >= DAILY_NEW_MAX}
          />
          {isHighIntensity(dailyNewLimit) && (
            <Text style={styles.warn}>고강도 — 복습 누적이 빠르게 늘어요.</Text>
          )}
        </Section>

        {/* TTS */}
        <Section title="발음 듣기 (TTS)" hint="일본어 음성으로 읽어줍니다.">
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>켜기</Text>
            <Switch
              value={ttsEnabled}
              onValueChange={setTtsEnabled}
              trackColor={{ false: c.pressed, true: c.ink }}
              thumbColor={c.canvas}
              ios_backgroundColor={c.pressed}
            />
          </View>
          {ttsEnabled && (
            <>
              <View style={styles.ttsOptionRow}>
                <Text style={styles.switchLabel}>뜻 확인 시 단어 자동 재생</Text>
                <Switch
                  accessibilityLabel="뜻 확인 시 단어 자동 재생"
                  value={autoPlayWordTtsOnReveal}
                  onValueChange={setAutoPlayWordTtsOnReveal}
                  trackColor={{ false: c.pressed, true: c.ink }}
                  thumbColor={c.canvas}
                  ios_backgroundColor={c.pressed}
                />
              </View>
              <View style={styles.speedRow}>
                <Text style={styles.switchLabel}>속도</Text>
                <Stepper
                  value={`${ttsSpeed.toFixed(1)}x`}
                  onMinus={() => setTtsSpeed(ttsSpeed - SPEED_STEP)}
                  onPlus={() => setTtsSpeed(ttsSpeed + SPEED_STEP)}
                  minusDisabled={ttsSpeed <= TTS_SPEED_MIN + 1e-9}
                  plusDisabled={ttsSpeed >= TTS_SPEED_MAX - 1e-9}
                />
              </View>
            </>
          )}
        </Section>

        {/* 화면 테마 */}
        <Section title="화면 테마" hint="시스템 설정을 따르거나 직접 선택합니다.">
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map((option) => {
              const selected = themePreference === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setThemePreference(option.value)}
                  style={({ pressed }) => [
                    styles.themeChoice,
                    pressed && !selected && styles.themeChoicePressed,
                    selected && styles.themeChoiceSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.themeChoiceText, selected && styles.themeChoiceTextSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* 데이터 백업 */}
        <Section title="데이터 백업" hint="학습 기록을 JSON 파일로 내보내요.">
          <Pressable
            style={[styles.actionBtn, exporting && styles.actionBtnOff]}
            onPress={() => void onExport()}
            disabled={exporting}
            accessibilityRole="button"
          >
            {exporting ? (
              <ActivityIndicator color={c.ink} />
            ) : (
              <Text style={styles.actionText}>백업 내보내기 (JSON)</Text>
            )}
          </Pressable>
        </Section>

        {/* 정보 */}
        <Section title="정보">
          <Pressable
            style={styles.linkRow}
            onPress={() => router.push('/about')}
            accessibilityRole="button"
          >
            <Text style={styles.linkText}>앱 정보 · 라이선스 · 출처</Text>
            <Text style={styles.linkChevron}>›</Text>
          </Pressable>
        </Section>

        <Text style={styles.footer}>
          모든 학습 데이터는 이 기기에만 저장돼요. 외부로 전송하지 않습니다.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint && <Text style={styles.sectionHint}>{hint}</Text>}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Stepper({
  value,
  onMinus,
  onPlus,
  minusDisabled,
  plusDisabled,
}: {
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled?: boolean;
  plusDisabled?: boolean;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stepper}>
      <Pressable
        style={[styles.stepBtn, minusDisabled && styles.stepBtnOff]}
        onPress={onMinus}
        disabled={minusDisabled}
        accessibilityLabel="감소"
      >
        <Text style={styles.stepSign}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable
        style={[styles.stepBtn, plusDisabled && styles.stepBtnOff]}
        onPress={onPlus}
        disabled={plusDisabled}
        accessibilityLabel="증가"
      >
        <Text style={styles.stepSign}>＋</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.softer,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  h1: {
    ...typography.resultTitle,
    color: c.ink,
    marginBottom: spacing.sm,
  },
  section: {
    paddingVertical: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: c.pressed,
    gap: 6,
  },
  sectionTitle: {
    ...typography.body,
    fontFamily: font.medium,
    color: c.ink,
  },
  sectionHint: {
    ...typography.caption,
    color: c.body,
  },
  sectionBody: {
    marginTop: spacing.lg,
  },
  levelRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  levelChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.pressed,
    backgroundColor: 'transparent',
  },
  levelChipOn: {
    backgroundColor: c.ink,
    borderColor: c.ink,
  },
  levelText: {
    ...typography.caption,
    fontFamily: font.medium,
    color: c.body,
  },
  levelTextOn: {
    color: c.canvas,
  },
  warn: {
    marginTop: spacing.sm,
    ...typography.caption,
    color: c.body,
    fontFamily: font.medium,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  ttsOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  switchLabel: {
    ...typography.body,
    color: c.ink,
  },
  themeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  themeChoice: {
    flex: 1,
    minHeight: layout.touchTarget,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.pressed,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  themeChoicePressed: {
    backgroundColor: c.soft,
  },
  themeChoiceSelected: {
    backgroundColor: c.ink,
    borderColor: c.ink,
  },
  themeChoiceText: {
    ...typography.captionStrong,
    color: c.body,
  },
  themeChoiceTextSelected: {
    color: c.canvas,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: c.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnOff: {
    opacity: 0.35,
  },
  stepSign: {
    fontSize: 22,
    lineHeight: 26,
    fontFamily: font.medium,
    color: c.ink,
  },
  stepValue: {
    ...typography.body,
    fontFamily: font.medium,
    minWidth: 56,
    textAlign: 'center',
    color: c.ink,
  },
  actionBtn: {
    borderWidth: 1,
    borderColor: c.pressed,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionBtnOff: {
    opacity: 0.5,
  },
  actionText: {
    ...typography.body,
    color: c.ink,
    fontFamily: font.medium,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkText: {
    ...typography.body,
    color: c.ink,
  },
  linkChevron: {
    fontSize: 22,
    color: c.mute,
  },
  footer: {
    ...typography.caption,
    color: c.mute,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});

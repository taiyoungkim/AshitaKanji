// Design Ref: §6.2 설정 화면 — 레벨/일일 신규 한도/TTS.
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
import { JLPT_LEVELS, type JlptLevel } from '~/types/Card';
import {
  DAILY_NEW_MAX,
  DAILY_NEW_MIN,
  HIGH_INTENSITY_THRESHOLD,
  TTS_SPEED_MAX,
  TTS_SPEED_MIN,
  isHighIntensity,
  useSettingsStore,
} from '~/stores/SettingsStore';
import { buildExportService } from './buildExportService';

const DAILY_STEP = 1;
const SPEED_STEP = 0.1;

export default function SettingsScreen(): React.ReactNode {
  const selectedLevels = useSettingsStore((s) => s.selectedLevels);
  const dailyNewLimit = useSettingsStore((s) => s.dailyNewLimit);
  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);
  const ttsSpeed = useSettingsStore((s) => s.ttsSpeed);
  const highIntensityWarned = useSettingsStore((s) => s.highIntensityWarned);
  const toggleLevel = useSettingsStore((s) => s.toggleLevel);
  const setDailyNewLimit = useSettingsStore((s) => s.setDailyNewLimit);
  const setTtsEnabled = useSettingsStore((s) => s.setTtsEnabled);
  const setTtsSpeed = useSettingsStore((s) => s.setTtsSpeed);
  const acknowledgeHighIntensity = useSettingsStore((s) => s.acknowledgeHighIntensity);
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>설정</Text>

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
          <Text style={styles.warn}>⚠ 고강도 — 복습 누적이 빠르게 늘어요.</Text>
        )}
      </Section>

      {/* TTS */}
      <Section title="발음 듣기 (TTS)" hint="일본어 음성으로 읽어줍니다.">
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>켜기</Text>
          <Switch value={ttsEnabled} onValueChange={setTtsEnabled} />
        </View>
        {ttsEnabled && (
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
        )}
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
            <ActivityIndicator color="#0366d6" />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  content: { padding: 20, gap: 20 },
  h1: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  section: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    gap: 6,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  sectionHint: { fontSize: 13, color: '#888' },
  sectionBody: { marginTop: 10 },
  levelRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  levelChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d0d0d5',
    backgroundColor: '#fafafa',
  },
  levelChipOn: { backgroundColor: '#0366d6', borderColor: '#0366d6' },
  levelText: { fontSize: 15, fontWeight: '600', color: '#555' },
  levelTextOn: { color: 'white' },
  warn: { marginTop: 8, fontSize: 13, color: '#c0392b', fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  switchLabel: { fontSize: 15, color: '#333' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eef2f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnOff: { opacity: 0.35 },
  stepSign: { fontSize: 22, fontWeight: '700', color: '#0366d6' },
  stepValue: { fontSize: 17, fontWeight: '700', minWidth: 56, textAlign: 'center' },
  actionBtn: {
    backgroundColor: '#eef2f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionBtnOff: { opacity: 0.5 },
  actionText: { color: '#0366d6', fontSize: 15, fontWeight: '700' },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkText: { fontSize: 15, color: '#333' },
  linkChevron: { fontSize: 22, color: '#bbb' },
  footer: { fontSize: 12, color: '#aaa', textAlign: 'center', marginTop: 4 },
});

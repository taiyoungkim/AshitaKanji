import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { font, layout, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';
import {
  DAILY_NEW_MAX,
  DAILY_NEW_MIN,
  HIGH_INTENSITY_THRESHOLD,
  isHighIntensity,
  useSettingsStore,
} from '~/stores/SettingsStore';
import { JLPT_LEVELS, type JlptLevel } from '~/types/Card';
import { SettingsPage, SettingsStepper } from './SettingsControls';

export default function LearningSettingsScreen(): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const selectedLevels = useSettingsStore((state) => state.selectedLevels);
  const dailyNewLimit = useSettingsStore((state) => state.dailyNewLimit);
  const highIntensityWarned = useSettingsStore((state) => state.highIntensityWarned);
  const toggleLevel = useSettingsStore((state) => state.toggleLevel);
  const setDailyNewLimit = useSettingsStore((state) => state.setDailyNewLimit);
  const acknowledgeHighIntensity = useSettingsStore((state) => state.acknowledgeHighIntensity);

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
    <SettingsPage title="학습 설정">
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>학습 레벨</Text>
        <Text style={styles.description}>
          학습할 JLPT 레벨을 선택해주세요.{`\n`}최소 1개 이상 선택해야 합니다.
        </Text>
        <View style={styles.levels}>
          {JLPT_LEVELS.map((level: JlptLevel) => {
            const selected = selectedLevels.includes(level);
            return (
              <Pressable
                key={level}
                onPress={() => toggleLevel(level)}
                style={({ pressed }) => [
                  styles.level,
                  selected && styles.levelSelected,
                  pressed && !selected && styles.levelPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.levelLabel, selected && styles.levelLabelSelected]}>{level}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>하루 새 단어</Text>
        <Text style={styles.description}>
          하루에 새롭게 출제할 단어 수입니다.{`\n`}5~50개까지 설정할 수 있습니다.
        </Text>
        <SettingsStepper
          label="하루 새 단어"
          value={`${dailyNewLimit}개`}
          onMinus={() => changeDailyNew(-1)}
          onPlus={() => changeDailyNew(1)}
          minusDisabled={dailyNewLimit <= DAILY_NEW_MIN}
          plusDisabled={dailyNewLimit >= DAILY_NEW_MAX}
        />
        {isHighIntensity(dailyNewLimit) ? (
          <Text style={styles.warning}>고강도 — 복습 누적이 빠르게 늘어요.</Text>
        ) : null}
      </View>
    </SettingsPage>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    section: { marginBottom: layout.gapGroup },
    sectionTitle: { ...typography.listTitle, color: colors.ink, marginBottom: spacing.sm },
    description: { ...typography.body, color: colors.body, marginBottom: spacing.lg },
    levels: { flexDirection: 'row', gap: 10 },
    level: {
      flex: 1,
      minWidth: 0,
      height: layout.touchTarget,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.pressed,
      alignItems: 'center',
      justifyContent: 'center',
    },
    levelPressed: { backgroundColor: colors.soft },
    levelSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
    levelLabel: { ...typography.bodyStrong, color: colors.body },
    levelLabelSelected: { color: colors.onInk },
    warning: { ...typography.caption, fontFamily: font.medium, color: colors.warning, marginTop: spacing.sm },
  });

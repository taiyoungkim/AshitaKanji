import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { cardShadow, font, layout, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
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
  const { colors } = useTheme();
  const selectedLevels = useSettingsStore((state) => state.selectedLevels);
  const setLevels = useSettingsStore((state) => state.setLevels);
  const showReadingBeforeReveal = useSettingsStore((state) => state.showReadingBeforeReveal);
  const setShowReadingBeforeReveal = useSettingsStore((state) => state.setShowReadingBeforeReveal);
  const dailyNewLimit = useSettingsStore((state) => state.dailyNewLimit);
  const highIntensityWarned = useSettingsStore((state) => state.highIntensityWarned);
  const setDailyNewLimit = useSettingsStore((state) => state.setDailyNewLimit);
  const acknowledgeHighIntensity = useSettingsStore((state) => state.acknowledgeHighIntensity);

  const toggleLevel = (level: JlptLevel) => {
    if (selectedLevels.includes(level)) {
      if (selectedLevels.length === 1) return;
      setLevels(selectedLevels.filter((item) => item !== level));
      return;
    }
    setLevels([...selectedLevels, level]);
  };

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
        <View style={styles.levelCard}>
          {JLPT_LEVELS.map((level) => {
            const selected = selectedLevels.includes(level);
            return (
              <Pressable
                key={level}
                onPress={() => toggleLevel(level)}
                style={({ pressed }) => [
                  styles.levelChip,
                  selected && styles.levelChipSelected,
                  pressed && !selected && styles.levelChipPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${level} 학습`}
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
          하루에 새롭게 출제할 단어 수입니다. 5~50개까지 설정할 수 있습니다.
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>카드 표시</Text>
        <View style={styles.card}>
          <View style={styles.optionRow}>
            <View style={styles.copy}>
              <Text style={styles.optionTitle}>뜻 보기 전 후리가나</Text>
              <Text style={styles.optionDescription}>
                끄면 공부와 회독 카드 모두 뜻을 확인할 때까지 읽는 법이 가려져요.
              </Text>
            </View>
            <Switch
              style={styles.toggle}
              value={showReadingBeforeReveal}
              onValueChange={setShowReadingBeforeReveal}
              trackColor={{ false: colors.pressed, true: colors.ink }}
              thumbColor={showReadingBeforeReveal ? colors.onInk : colors.canvas}
              ios_backgroundColor={colors.pressed}
              accessibilityLabel="뜻 보기 전 후리가나"
            />
          </View>
        </View>
      </View>
    </SettingsPage>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    section: { marginBottom: layout.gapGroup },
    sectionTitle: { ...typography.listTitle, color: colors.ink, marginBottom: spacing.sm },
    description: { ...typography.body, color: colors.body, marginBottom: spacing.lg },
    warning: { ...typography.caption, fontFamily: font.medium, color: colors.warning, marginTop: spacing.sm },
    levelCard: {
      minHeight: 72,
      borderRadius: radius.card,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.canvas,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      ...cardShadow(colors),
    },
    levelChip: {
      flex: 1,
      aspectRatio: 1,
      maxWidth: 48,
      borderRadius: radius.pill,
      backgroundColor: colors.soft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    levelChipSelected: { backgroundColor: colors.ink },
    levelChipPressed: { backgroundColor: colors.pressed },
    levelLabel: { ...typography.captionStrong, color: colors.body },
    levelLabelSelected: { color: colors.onInk },
    card: {
      borderRadius: radius.card,
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.canvas,
      ...cardShadow(colors),
    },
    optionRow: {
      minHeight: 84,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    copy: { flex: 1, gap: spacing.xs },
    toggle: { alignSelf: 'center', flexShrink: 0 },
    optionTitle: { ...typography.cardTitle, color: colors.ink },
    optionDescription: { ...typography.body, color: colors.body },
  });

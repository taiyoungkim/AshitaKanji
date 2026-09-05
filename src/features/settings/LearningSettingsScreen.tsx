import { Alert, StyleSheet, Text, View } from 'react-native';
import { font, layout, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';
import {
  DAILY_NEW_MAX,
  DAILY_NEW_MIN,
  HIGH_INTENSITY_THRESHOLD,
  isHighIntensity,
  useSettingsStore,
} from '~/stores/SettingsStore';
import { SettingsPage, SettingsStepper } from './SettingsControls';

export default function LearningSettingsScreen(): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const dailyNewLimit = useSettingsStore((state) => state.dailyNewLimit);
  const highIntensityWarned = useSettingsStore((state) => state.highIntensityWarned);
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
        <Text style={styles.sectionTitle}>하루 새 단어</Text>
        <Text style={styles.description}>
          하루에 새롭게 출제할 최대 단어 수입니다.{`\n`}복습이 많이 밀리면 새 단어는 자동으로 줄어듭니다.
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
    warning: { ...typography.caption, fontFamily: font.medium, color: colors.warning, marginTop: spacing.sm },
  });

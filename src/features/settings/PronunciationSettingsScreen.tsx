import { StyleSheet, Switch, Text, View } from 'react-native';
import { font, radius, spacing, type ThemeColors } from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import {
  TTS_SPEED_MAX,
  TTS_SPEED_MIN,
  useSettingsStore,
} from '~/stores/SettingsStore';
import { SettingsPage, SettingsStepper } from './SettingsControls';

const SPEED_STEP = 0.1;

export default function PronunciationSettingsScreen(): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const ttsEnabled = useSettingsStore((state) => state.ttsEnabled);
  const ttsSpeed = useSettingsStore((state) => state.ttsSpeed);
  const autoPlay = useSettingsStore((state) => state.autoPlayWordTtsOnReveal);
  const setTtsEnabled = useSettingsStore((state) => state.setTtsEnabled);
  const setTtsSpeed = useSettingsStore((state) => state.setTtsSpeed);
  const setAutoPlay = useSettingsStore((state) => state.setAutoPlayWordTtsOnReveal);

  return (
    <SettingsPage title="발음 설정" dismissIcon="close">
      <View style={styles.card}>
        <View style={styles.optionRow}>
          <View style={styles.copy}>
            <Text style={styles.optionTitle}>발음 듣기</Text>
            <Text style={styles.optionDescription}>일본어 단어의 발음을 재생합니다.</Text>
          </View>
          <View style={styles.toggleFrame}>
            <Switch
              style={styles.toggle}
              value={ttsEnabled}
              onValueChange={setTtsEnabled}
              trackColor={{ false: colors.pressed, true: colors.ink }}
              thumbColor={ttsEnabled ? colors.onInk : colors.canvas}
              ios_backgroundColor={colors.pressed}
              accessibilityLabel="발음 듣기"
            />
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.optionRow}>
          <View style={styles.copy}>
            <Text style={styles.optionTitle}>뜻 확인 시 자동 재생</Text>
            <Text style={styles.optionDescription}>뜻을 확인하면 단어의 발음을 자동으로 재생합니다.</Text>
          </View>
          <View style={styles.toggleFrame}>
            <Switch
              style={styles.toggle}
              value={autoPlay}
              onValueChange={setAutoPlay}
              disabled={!ttsEnabled}
              trackColor={{ false: colors.pressed, true: colors.ink }}
              thumbColor={autoPlay && ttsEnabled ? colors.onInk : colors.canvas}
              ios_backgroundColor={colors.pressed}
              accessibilityLabel="뜻 확인 시 자동 재생"
            />
          </View>
        </View>
      </View>

      <View style={styles.speedSection}>
        <Text style={styles.sectionTitle}>재생 속도</Text>
        <SettingsStepper
          label="발음 속도"
          value={`${ttsSpeed.toFixed(1)}x`}
          onMinus={() => setTtsSpeed(ttsSpeed - SPEED_STEP)}
          onPlus={() => setTtsSpeed(ttsSpeed + SPEED_STEP)}
          minusDisabled={!ttsEnabled || ttsSpeed <= TTS_SPEED_MIN + 1e-9}
          plusDisabled={!ttsEnabled || ttsSpeed >= TTS_SPEED_MAX - 1e-9}
        />
      </View>
    </SettingsPage>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.card,
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.canvas,
    },
    optionRow: {
      height: 88,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    copy: { flex: 1, gap: spacing.xs },
    toggleFrame: {
      width: 39,
      height: 24,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toggle: { transform: [{ scaleX: 39 / 51 }, { scaleY: 24 / 31 }] },
    optionTitle: {
      fontFamily: font.medium,
      fontSize: 18,
      lineHeight: 26,
      color: colors.ink,
    },
    optionDescription: {
      fontFamily: font.medium,
      fontSize: 13,
      lineHeight: 18,
      color: colors.body,
    },
    divider: { height: 1, backgroundColor: colors.pressed },
    speedSection: { marginTop: 30 },
    sectionTitle: {
      fontFamily: font.regular,
      fontSize: 16,
      lineHeight: 24,
      color: colors.ink,
      marginBottom: spacing.lg,
    },
  });

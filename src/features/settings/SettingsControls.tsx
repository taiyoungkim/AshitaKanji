import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { font, layout, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';

export function SettingsPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactNode {
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Pressable
        onPress={() => router.back()}
        style={styles.back}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="뒤로"
      >
        <Text style={styles.backIcon}>‹</Text>
        <Text style={styles.backLabel}>뒤로</Text>
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      {children}
    </SafeAreaView>
  );
}

export function SettingsStepper({
  label,
  value,
  onMinus,
  onPlus,
  minusDisabled = false,
  plusDisabled = false,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled?: boolean;
  plusDisabled?: boolean;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stepper}>
      <StepperButton
        sign="−"
        label={`${label} 감소, 현재 ${value}`}
        onPress={onMinus}
        disabled={minusDisabled}
      />
      <Text style={styles.stepperValue}>{value}</Text>
      <StepperButton
        sign="＋"
        label={`${label} 증가, 현재 ${value}`}
        onPress={onPlus}
        disabled={plusDisabled}
      />
    </View>
  );
}

function StepperButton({
  sign,
  label,
  onPress,
  disabled,
}: {
  sign: string;
  label: string;
  onPress: () => void;
  disabled: boolean;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.stepperButton,
        pressed && !disabled && styles.stepperButtonPressed,
        disabled && styles.disabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Text style={styles.stepperSign}>{sign}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.softer, paddingHorizontal: layout.gutter },
    back: {
      minHeight: layout.touchTarget,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: -spacing.xs,
    },
    backIcon: { fontSize: 34, lineHeight: 36, color: colors.ink },
    backLabel: { ...typography.body, color: colors.ink, marginLeft: -spacing.xs },
    title: { ...typography.meaning, color: colors.ink, marginBottom: spacing.xxl },
    stepper: {
      minHeight: 80,
      borderRadius: radius.card,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.canvas,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    stepperButton: {
      width: 52,
      height: 52,
      borderRadius: radius.pill,
      backgroundColor: colors.soft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperButtonPressed: { backgroundColor: colors.pressed },
    disabled: { opacity: 0.35 },
    stepperSign: { fontFamily: font.regular, fontSize: 30, lineHeight: 34, color: colors.ink },
    stepperValue: { ...typography.listTitle, color: colors.ink, fontVariant: ['tabular-nums'] },
  });

import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { font, layout, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';

export function SettingsPage({
  title,
  children,
  dismissIcon = 'back',
}: {
  title: string;
  children: React.ReactNode;
  dismissIcon?: 'back' | 'close';
}): React.ReactNode {
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.dismiss, pressed && styles.dismissPressed]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={dismissIcon === 'close' ? '닫기' : '뒤로'}
        >
          <Text style={dismissIcon === 'close' ? styles.closeIcon : styles.backIcon}>
            {dismissIcon === 'close' ? '×' : '‹'}
          </Text>
        </Pressable>
        <Text style={styles.title}>{title}</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
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
    root: { flex: 1, backgroundColor: colors.softer },
    header: {
      minHeight: 56,
      paddingHorizontal: layout.gutter,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dismiss: {
      position: 'absolute',
      left: layout.gutter,
      width: layout.touchTarget,
      height: layout.touchTarget,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dismissPressed: { backgroundColor: colors.soft },
    backIcon: { fontSize: 34, lineHeight: 36, color: colors.ink, marginTop: -2 },
    closeIcon: { fontFamily: font.regular, fontSize: 30, lineHeight: 32, color: colors.ink },
    title: { ...typography.cardTitle, color: colors.ink, textAlign: 'center' },
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: layout.gutter,
      paddingTop: spacing.md,
      paddingBottom: spacing.huge,
    },
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

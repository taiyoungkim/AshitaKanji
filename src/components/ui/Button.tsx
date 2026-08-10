// Onikan 버튼.
//
// primary(오렌지)는 화면당 정확히 하나다. 두 번째가 생기면 그건 secondary 다.
// 학습 평가처럼 동급 버튼이 나란히 서는 자리에는 오렌지를 쓰지 않고 outline↔ink 로 층을 만든다.

import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { border, layout, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';

export type ButtonVariant =
  /** 화면의 단 하나뿐인 주요 액션. */
  | 'primary'
  /** 흰 면 + ink 글자. */
  | 'secondary'
  /** soft 회색 필 — 카드 안 3차 액션. */
  | 'subtle'
  /** 테두리만 — 평가쌍의 약한 쪽. */
  | 'outline'
  /** ink 솔리드 — 평가쌍의 강한 쪽. */
  | 'ink';

interface Props {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** 평가쌍처럼 나란히 놓을 때 60pt 로 키운다. */
  tall?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  tall = false,
  style,
  accessibilityLabel,
}: Props): React.ReactNode {
  const styles = useThemedStyles(makeStyles);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        tall && styles.tall,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, styles[`${variant}Label`], tall && styles.tallLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    base: {
      minHeight: layout.ctaHeight,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      borderWidth: border.chip,
      borderColor: 'transparent',
    },
    tall: { minHeight: layout.gradeButtonHeight },
    pressed: { opacity: 0.85 },
    disabled: { opacity: 0.4 },

    primary: { backgroundColor: c.primary },
    secondary: { backgroundColor: c.canvas },
    subtle: { backgroundColor: c.soft, minHeight: layout.touchTarget },
    outline: { backgroundColor: 'transparent', borderColor: c.pressed },
    ink: { backgroundColor: c.ink },

    label: { ...typography.cta, textAlign: 'center' },
    tallLabel: { fontSize: 17 },
    primaryLabel: { color: c.onPrimary },
    secondaryLabel: { color: c.ink },
    subtleLabel: { color: c.ink, fontSize: 16 },
    outlineLabel: { color: c.ink },
    inkLabel: { color: c.softer },
  });

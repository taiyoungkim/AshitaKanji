import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, spacing, typography } from '~/design/tokens';

interface Props {
  label: string;
  value: string | number;
  valueSize?: 'large' | 'small';
  borderBottom?: boolean;
  mutedValue?: boolean;
  style?: StyleProp<ViewStyle>;
  valueStyle?: StyleProp<TextStyle>;
}

export function LabelValueRow({
  label,
  value,
  valueSize = 'large',
  borderBottom = false,
  mutedValue = false,
  style,
  valueStyle,
}: Props): React.ReactNode {
  return (
    <View style={[styles.wrap, borderBottom && styles.withBorder, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[
          valueSize === 'large' ? styles.valueLarge : styles.valueSmall,
          mutedValue && styles.mutedValue,
          valueStyle,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: spacing.md,
  },
  withBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: {
    ...typography.tiny,
    color: colors.textSecondary,
  },
  valueLarge: {
    ...typography.h2,
    color: colors.text,
  },
  valueSmall: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '500',
    color: colors.text,
  },
  mutedValue: {
    color: colors.textTertiary,
  },
});

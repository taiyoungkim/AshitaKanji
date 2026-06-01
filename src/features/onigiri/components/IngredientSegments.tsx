import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, spacing, typography } from '~/design/tokens';

interface Props {
  count: number;
  total?: number;
  label?: string | false;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function IngredientSegments({
  count,
  total = 4,
  label,
  compact = false,
  style,
}: Props): React.ReactNode {
  const safeTotal = Math.max(0, total);
  const safeCount = clamp(count, 0, safeTotal);
  const text = label === undefined ? `${safeCount} / ${safeTotal} INGREDIENTS` : label;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact, style]}>
      <View style={styles.segs}>
        {Array.from({ length: safeTotal }, (_, index) => (
          <View
            key={index}
            style={[
              styles.seg,
              compact && styles.segCompact,
              index < safeCount && styles.segFill,
            ]}
          />
        ))}
      </View>
      {text !== false && <Text style={styles.count}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  wrapCompact: {
    gap: 6,
  },
  segs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  seg: {
    width: 11,
    height: 11,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: colors.text,
  },
  segCompact: {
    width: 9,
    height: 9,
    borderRadius: 2.5,
  },
  segFill: {
    backgroundColor: colors.text,
  },
  count: {
    ...typography.small,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
});

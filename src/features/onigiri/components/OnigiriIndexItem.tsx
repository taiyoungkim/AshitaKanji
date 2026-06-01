import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, fontFamily, typography } from '~/design/tokens';
import type { OnigiriProgressEntry } from '../progress';

interface Props {
  entry: OnigiriProgressEntry;
  onPress?: (entry: OnigiriProgressEntry) => void;
  style?: StyleProp<ViewStyle>;
}

function padOrder(order: number): string {
  return String(order).padStart(3, '0');
}

export function formatOnigiriDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}.${m}.${day}`;
}

export function OnigiriIndexItem({ entry, onPress, style }: Props): React.ReactNode {
  const locked = entry.status === 'locked';
  const title = locked ? 'LOCKED' : entry.item.name;
  const detail =
    entry.status === 'completed' && entry.completedAt
      ? formatOnigiriDate(entry.completedAt)
      : entry.status === 'inProgress'
        ? `${entry.ingredientCount} / 4`
        : '';
  const body = (
    <View style={[styles.row, style]}>
      <Text style={[styles.no, locked && styles.tertiary]}>{padOrder(entry.item.order)}</Text>
      <Text style={[styles.name, locked && styles.lockedName]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.detail}>{detail}</Text>
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={() => onPress(entry)}
      accessibilityRole="button"
      accessibilityLabel={`${padOrder(entry.item.order)} ${title}`}
    >
      {({ pressed }) => (
        <View style={pressed && styles.pressed}>
          {body}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 18,
  },
  no: {
    width: 42,
    fontFamily: fontFamily.mono,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  name: {
    ...typography.body,
    flex: 1,
    color: colors.text,
  },
  lockedName: {
    ...typography.small,
    color: colors.textTertiary,
    letterSpacing: 1,
  },
  detail: {
    ...typography.small,
    minWidth: 52,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  tertiary: {
    color: colors.textTertiary,
  },
  pressed: {
    opacity: 0.55,
  },
});

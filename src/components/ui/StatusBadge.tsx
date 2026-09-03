import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';

export type StatusBadgeKind = 'inProgress' | 'complete' | 'locked' | 'new';

export function StatusBadge({ kind, label }: { kind: StatusBadgeKind; label: string }): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.base, styles[kind]]}>
      <Text style={[styles.label, styles[`${kind}Label`]]}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    base: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
    label: { ...typography.captionStrong },
    inProgress: { backgroundColor: c.primarySoft },
    inProgressLabel: { color: c.primaryPressed },
    complete: { backgroundColor: c.secondarySoft },
    completeLabel: { color: c.success },
    locked: { backgroundColor: c.soft },
    lockedLabel: { color: c.mute },
    new: { backgroundColor: c.primary },
    newLabel: { color: c.onPrimary },
  });

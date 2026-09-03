import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';

interface Props {
  value: number | string;
  label: string;
  icon?: ReactNode;
}

/** Figma `Ratio` — 숫자와 짧은 라벨을 한 덩어리로 보여 주는 지표 타일. */
export function StatTile({ value, label, icon }: Props): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Text style={styles.value}>{value}</Text>
        {icon}
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      minHeight: 76,
      borderRadius: radius.tileSm,
      backgroundColor: c.softer,
      padding: spacing.md,
      justifyContent: 'space-between',
    },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    value: { ...typography.cardTitle, color: c.ink, fontVariant: ['tabular-nums'] },
    label: { ...typography.caption, color: c.body },
  });

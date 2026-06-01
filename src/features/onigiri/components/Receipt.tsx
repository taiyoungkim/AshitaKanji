import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, fontFamily, fontWeight, spacing, typography } from '~/design/tokens';

export interface ReceiptRow {
  label: string;
  value: string | number | null | undefined;
}

interface Props {
  dateLabel: string;
  rows: readonly ReceiptRow[];
  title?: string;
  thanks?: string;
  style?: StyleProp<ViewStyle>;
}

export function Receipt({
  dateLabel,
  rows,
  title = 'ONIGIRI SHOP',
  thanks = 'THANK YOU.',
  style,
}: Props): React.ReactNode {
  const visibleRows = rows.filter((row) => row.value !== null && row.value !== undefined && row.value !== '');

  return (
    <View style={[styles.receipt, style]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.date}>{dateLabel}</Text>
      <View style={styles.dash} />
      {visibleRows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={styles.rowLabel}>{row.label}</Text>
          <Text style={styles.rowValue}>{row.value}</Text>
        </View>
      ))}
      <View style={styles.dash} />
      <Text style={styles.thanks}>{thanks}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  receipt: {
    width: 268,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 26,
    paddingHorizontal: 22,
    shadowColor: colors.black,
    shadowOpacity: 0.04,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },
  title: {
    fontFamily: fontFamily.mono,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: fontWeight.medium,
    letterSpacing: 2,
    color: colors.text,
    textAlign: 'center',
  },
  date: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  dash: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    marginVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 3,
  },
  rowLabel: {
    ...typography.receipt,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  rowValue: {
    ...typography.receipt,
    color: colors.text,
    letterSpacing: 0.5,
    textAlign: 'right',
  },
  thanks: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    lineHeight: 20,
    color: colors.text,
    letterSpacing: 2,
    textAlign: 'center',
  },
});

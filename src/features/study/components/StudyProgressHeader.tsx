// 닫기 · 현재 위치 · 연속 진행바.
// stacked = 온보딩/학습 HTML (✕ + 중앙 카운트, 아래 바).
// inline = today-review/review-hub (✕ | 바 | 1/N 한 줄).

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { layout, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import { IconClose } from '~/design/icons';

interface Props {
  done: number;
  total: number;
  onClose: () => void;
  closeLabel?: string;
  variant?: 'stacked' | 'inline';
}

export function StudyProgressHeader({
  done,
  total,
  onClose,
  closeLabel = '학습 종료',
  variant = 'stacked',
}: Props): React.ReactNode {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const safeTotal = Math.max(total, 1);
  const safeDone = Math.min(Math.max(done, 0), safeTotal);
  const position = Math.min(safeDone + 1, safeTotal);
  const fillPct = (safeDone / safeTotal) * 100;

  const close = (
    <Pressable
      onPress={onClose}
      hitSlop={8}
      style={styles.close}
      accessibilityRole="button"
      accessibilityLabel={closeLabel}
    >
      <IconClose size={24} color={colors.body} />
    </Pressable>
  );

  const count = (
    <Text style={styles.position} accessibilityLabel={`${safeTotal}개 중 ${position}번째`}>
      {position} / {safeTotal}
    </Text>
  );

  const bar = (height: number) => (
    <View
      style={[styles.track, { height, backgroundColor: colors.pressed }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: safeTotal, now: safeDone }}
    >
      <View style={[styles.fill, { backgroundColor: colors.ink, width: `${fillPct}%` as `${number}%` }]} />
    </View>
  );

  if (variant === 'inline') {
    return (
      <View style={styles.inlineRow}>
        {close}
        <View style={styles.inlineBar}>{bar(6)}</View>
        <Text style={styles.inlineCount} accessibilityLabel={`${safeTotal}개 중 ${position}번째`}>
          {position} / {safeTotal}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.row}>
        {close}
        {count}
        <View style={styles.close} />
      </View>
      {bar(4)}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 14,
      paddingHorizontal: layout.gapTight,
      paddingBottom: spacing.sm,
    },
    inlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      minHeight: 44,
      paddingHorizontal: layout.gutter,
      paddingTop: 6,
    },
    inlineBar: { flex: 1 },
    close: {
      width: layout.touchTarget,
      height: layout.touchTarget,
      alignItems: 'center',
      justifyContent: 'center',
    },
    position: {
      ...typography.captionStrong,
      color: c.body,
      flex: 1,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    inlineCount: {
      ...typography.bodyStrong,
      color: c.body,
      fontVariant: ['tabular-nums'],
      minWidth: 52,
      textAlign: 'right',
    },
    track: { borderRadius: radius.pill, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: radius.pill },
  });

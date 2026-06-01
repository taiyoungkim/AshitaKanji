// Design Ref: §5.2 — 세션 진행 표시 (남은 카드 + Main/Again 단계).

import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, fontWeight, spacing, typography } from '~/design/tokens';
import type { SessionState } from '~/types/Session';

interface Props {
  state: SessionState;
}

export function SessionProgress({ state }: Props): React.ReactNode {
  const queue = state.phase === 'again' ? state.againQueue : state.mainQueue;
  const total = queue.length;
  const done = Math.min(state.currentIndex, total);
  const pct = total > 0 ? done / total : 0;
  const phaseLabel = state.phase === 'again' ? '복습 마무리' : '오늘 학습';

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.phase}>{phaseLabel}</Text>
        <Text style={styles.count}>
          {done} / {total}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(pct * 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  phase: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  count: {
    ...typography.small,
    fontFamily: fontFamily.mono,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  track: { height: 6, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.text },
});

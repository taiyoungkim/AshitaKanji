// Design Ref: Onikan handoff 화면 2 (`1b`) — 진행 헤더.
// 닫기 · 칸 진행바 · 남은 개수. 진행바는 세션 카드 수만큼 칸을 나눈다.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { layout, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import { IconClose } from '~/design/icons';
import type { SessionState } from '~/types/Session';

interface Props {
  state: SessionState;
  onClose: () => void;
}

export function StudyHeader({ state, onClose }: Props): React.ReactNode {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const queue = state.phase === 'again' ? state.againQueue : state.mainQueue;
  const total = Math.max(queue.length, 1);
  const done = Math.min(state.currentIndex, total);
  const remaining = Math.max(total - done, 0);

  return (
    <View style={styles.header}>
      <Pressable
        onPress={onClose}
        hitSlop={8}
        style={styles.close}
        accessibilityRole="button"
        accessibilityLabel="학습 종료"
      >
        <IconClose size={24} color={colors.body} />
      </Pressable>

      <View style={styles.track}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={[styles.cell, { backgroundColor: i < done ? colors.ink : colors.pressed }]}
          />
        ))}
      </View>

      <Text style={styles.remaining}>{remaining}개 남음</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: layout.gapTight,
      paddingTop: 14,
      paddingHorizontal: layout.gapTight,
    },
    close: {
      width: layout.touchTarget,
      height: layout.touchTarget,
      alignItems: 'center',
      justifyContent: 'center',
    },
    track: { flex: 1, flexDirection: 'row', gap: spacing.xs },
    cell: { flex: 1, height: 4, borderRadius: radius.pill },
    remaining: {
      ...typography.captionStrong,
      color: c.body,
      paddingRight: spacing.lg,
    },
  });

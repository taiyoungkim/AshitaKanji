// 연습 — 흐린 글자 없이 쓰는 격자 없는 빈 연습장.
// 따라쓰기는 이전 탭에서 끝났으므로 이 화면에 가이드 칸을 중복 노출하지 않는다.

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';
import { TraceCell, TraceToolbar } from './TraceCell';
import type { Pt } from './strokePath';

export function PracticePad({
  literal,
  width,
  height,
  onDrawStart,
  onDrawEnd,
}: {
  literal: string;
  width: number;
  height: number;
  onDrawStart?: () => void;
  onDrawEnd?: () => void;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const padHeight = Math.max(360, Math.min(width, Math.floor(height * 0.72)));
  const pen = Math.max(4, width * 0.013);

  const [pad, setPad] = useState<Pt[][]>([]);
  const isEmpty = pad.length === 0;

  return (
    <View style={styles.wrap}>
      <TraceCell
        literal={literal}
        width={width}
        height={padHeight}
        showGlyph={false}
        showGrid={false}
        pen={pen}
        strokes={pad}
        onCommitStroke={(stroke) => setPad((previous) => [...previous, stroke])}
        onDrawStart={onDrawStart}
        onDrawEnd={onDrawEnd}
      />

      <TraceToolbar
        onUndo={() => setPad((previous) => previous.slice(0, -1))}
        onClear={() => setPad([])}
        disabled={isEmpty}
      />
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.xl },
});

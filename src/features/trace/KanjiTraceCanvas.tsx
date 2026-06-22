// 따라쓰기(단일) — 흐린 글자 가이드 한 칸 + 되돌리기/지우기.

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '~/design/tokens';
import { TraceCell, TraceToolbar } from './TraceCell';
import type { Pt } from './strokePath';

export function KanjiTraceCanvas({
  literal,
  size,
  onDrawStart,
  onDrawEnd,
}: {
  literal: string;
  size: number;
  onDrawStart?: () => void;
  onDrawEnd?: () => void;
}): React.ReactNode {
  const [strokes, setStrokes] = useState<Pt[][]>([]);
  const isEmpty = strokes.length === 0;

  return (
    <View style={styles.wrap}>
      <TraceCell
        literal={literal}
        width={size}
        height={size}
        showGlyph
        showGrid
        strokes={strokes}
        onCommitStroke={(s) => setStrokes((prev) => [...prev, s])}
        onDrawStart={onDrawStart}
        onDrawEnd={onDrawEnd}
      />
      <TraceToolbar
        onUndo={() => setStrokes((prev) => prev.slice(0, -1))}
        onClear={() => setStrokes([])}
        disabled={isEmpty}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.lg },
});

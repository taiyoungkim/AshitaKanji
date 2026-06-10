// 연습 — 가이드 칸(흐린 글자 + 米 격자) 하나 + 그 아래 격자 없는 큰 빈 연습장.
// 연습장에 자유롭게 여러 번 반복해 쓴다. 펜 두께는 가이드 칸 기준으로 통일.
// 되돌리기=가이드/연습장 통틀어 마지막 획, 지우기=전체 초기화.

import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontWeight, spacing, typography } from '~/design/tokens';
import { TraceCell, TraceToolbar } from './TraceCell';
import type { Pt } from './strokePath';

type Surface = 'guide' | 'pad';

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
  const guideSize = Math.min(Math.floor(width * 0.42), 220);
  const padHeight = Math.max(360, Math.min(Math.floor(height * 0.95), 900));
  const pen = Math.max(3, guideSize * 0.03);

  const [guide, setGuide] = useState<Pt[][]>([]);
  const [pad, setPad] = useState<Pt[][]>([]);
  // 되돌리기용: 획을 그린 표면 스택.
  const historyRef = useRef<Surface[]>([]);

  const commitGuide = (s: Pt[]) => {
    historyRef.current.push('guide');
    setGuide((prev) => [...prev, s]);
  };
  const commitPad = (s: Pt[]) => {
    historyRef.current.push('pad');
    setPad((prev) => [...prev, s]);
  };
  const undo = () => {
    const last = historyRef.current.pop();
    if (!last) return;
    if (last === 'guide') setGuide((prev) => prev.slice(0, -1));
    else setPad((prev) => prev.slice(0, -1));
  };
  const clear = () => {
    historyRef.current = [];
    setGuide([]);
    setPad([]);
  };

  const isEmpty = guide.length === 0 && pad.length === 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.guideRow}>
        <TraceCell
          literal={literal}
          width={guideSize}
          height={guideSize}
          showGlyph
          showGrid
          pen={pen}
          strokes={guide}
          onCommitStroke={commitGuide}
          onDrawStart={onDrawStart}
          onDrawEnd={onDrawEnd}
        />
        <Text style={styles.guideLabel}>가이드</Text>
      </View>

      <TraceCell
        literal={literal}
        width={width}
        height={padHeight}
        showGlyph={false}
        showGrid={false}
        pen={pen}
        strokes={pad}
        onCommitStroke={commitPad}
        onDrawStart={onDrawStart}
        onDrawEnd={onDrawEnd}
      />

      <TraceToolbar onUndo={undo} onClear={clear} disabled={isEmpty} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.lg },
  guideRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.md },
  guideLabel: { ...typography.small, color: colors.textTertiary, fontWeight: fontWeight.medium },
});

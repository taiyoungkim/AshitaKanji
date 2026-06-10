// 따라쓰기/연습 공용 그리기 표면 (선택적 米 격자 + 흐린 글자 + 펜/손가락 입력).
// width/height 임의 → 정사각 가이드 칸, 큰 직사각 자유 연습장 모두 표현.
// 확정 획(strokes)은 부모 소유(controlled). 진행 중 획만 내부 상태로 라이브 렌더.

import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { colors, fontWeight, radius, spacing, typography } from '~/design/tokens';
import { strokeToPath, type Pt } from './strokePath';

const INK = '#1B1B1B';
const GUIDE = '#E2E2DE';
const GLYPH = '#ECECE8';

export function TraceCell({
  literal,
  width,
  height,
  showGlyph,
  showGrid,
  pen,
  strokes,
  onCommitStroke,
  onDrawStart,
  onDrawEnd,
}: {
  literal: string;
  width: number;
  height: number;
  showGlyph: boolean;
  showGrid: boolean;
  pen?: number;
  strokes: Pt[][];
  onCommitStroke: (stroke: Pt[]) => void;
  // 그리는 동안 부모 ScrollView 스크롤을 끄기 위한 콜백.
  onDrawStart?: () => void;
  onDrawEnd?: () => void;
}): React.ReactNode {
  const [current, setCurrent] = useState<Pt[]>([]);
  const currentRef = useRef<Pt[]>([]);
  // PanResponder 는 한 번만 생성(제스처 도중 재생성 방지). 콜백은 ref 로 최신화.
  const commitRef = useRef(onCommitStroke);
  commitRef.current = onCommitStroke;
  const drawStartRef = useRef(onDrawStart);
  drawStartRef.current = onDrawStart;
  const drawEndRef = useRef(onDrawEnd);
  drawEndRef.current = onDrawEnd;

  const pan = useMemo(
    () =>
      PanResponder.create({
        // 부모 ScrollView 가 세로 드래그를 가로채 화면이 스크롤되는 문제 방지:
        // 터치 시작/이동 시점에 캡처하고, 한 번 잡으면 ScrollView 에 양보하지 않는다.
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (e) => {
          drawStartRef.current?.();
          currentRef.current = [{ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }];
          setCurrent(currentRef.current);
        },
        onPanResponderMove: (e) => {
          currentRef.current = [
            ...currentRef.current,
            { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY },
          ];
          setCurrent(currentRef.current);
        },
        onPanResponderRelease: () => {
          const done = currentRef.current;
          if (done.length > 0) commitRef.current(done);
          currentRef.current = [];
          setCurrent([]);
          drawEndRef.current?.();
        },
        onPanResponderTerminate: () => {
          const done = currentRef.current;
          if (done.length > 0) commitRef.current(done);
          currentRef.current = [];
          setCurrent([]);
          drawEndRef.current?.();
        },
      }),
    [],
  );

  const minDim = Math.min(width, height);
  const inset = minDim * 0.04;
  const ink = pen ?? Math.max(2, minDim * 0.03);

  return (
    <View style={[styles.board, { width, height }]} {...pan.panHandlers}>
      {showGlyph ? (
        <Text
          pointerEvents="none"
          style={[styles.glyph, { fontSize: minDim * 0.78, lineHeight: height }]}
        >
          {literal}
        </Text>
      ) : null}
      <Svg
        pointerEvents="none"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={StyleSheet.absoluteFill}
      >
        {showGrid ? (
          <>
            <Rect x={inset} y={inset} width={width - inset * 2} height={height - inset * 2} fill="none" stroke={GUIDE} strokeWidth={1} />
            <Line x1={width / 2} y1={inset} x2={width / 2} y2={height - inset} stroke={GUIDE} strokeWidth={1} strokeDasharray="6 6" />
            <Line x1={inset} y1={height / 2} x2={width - inset} y2={height / 2} stroke={GUIDE} strokeWidth={1} strokeDasharray="6 6" />
            <Line x1={inset} y1={inset} x2={width - inset} y2={height - inset} stroke={GUIDE} strokeWidth={1} strokeDasharray="6 6" />
            <Line x1={width - inset} y1={inset} x2={inset} y2={height - inset} stroke={GUIDE} strokeWidth={1} strokeDasharray="6 6" />
          </>
        ) : null}
        {strokes.map((s, i) => (
          <Path key={i} d={strokeToPath(s)} stroke={INK} strokeWidth={ink} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ))}
        {current.length > 0 ? (
          <Path d={strokeToPath(current)} stroke={INK} strokeWidth={ink} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ) : null}
      </Svg>
    </View>
  );
}

export function TraceToolbar({
  onUndo,
  onClear,
  disabled,
}: {
  onUndo: () => void;
  onClear: () => void;
  disabled: boolean;
}): React.ReactNode {
  return (
    <View style={styles.toolbar}>
      <Pressable
        style={[styles.toolBtn, disabled && styles.toolBtnOff]}
        onPress={onUndo}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="마지막 획 되돌리기"
      >
        <Text style={styles.toolText}>되돌리기</Text>
      </Pressable>
      <Pressable
        style={[styles.toolBtn, disabled && styles.toolBtnOff]}
        onPress={onClear}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="모두 지우기"
      >
        <Text style={styles.toolText}>지우기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  glyph: {
    ...StyleSheet.absoluteFillObject,
    textAlign: 'center',
    color: GLYPH,
    fontWeight: fontWeight.medium,
  },
  toolbar: { flexDirection: 'row', gap: spacing.md },
  toolBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  toolBtnOff: { opacity: 0.35 },
  toolText: { ...typography.body, color: colors.text, fontWeight: fontWeight.medium },
});

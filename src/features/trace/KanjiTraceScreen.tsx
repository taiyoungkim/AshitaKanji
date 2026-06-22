// 한자 따라쓰기 화면 (테블릿 전용). 진입: 단어 상세 → 한자 시트 → "따라쓰기".
// 상단 세그먼트 토글로 [따라쓰기 | 연습] 전환. 테블릿이 아니면 안내만.
// 데이터 변경 없음(읽기 전용 학습 보조).

import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, fontWeight, radius, spacing, typography } from '~/design/tokens';
import { useIsTablet } from '~/lib/device';
import { KanjiTraceCanvas } from './KanjiTraceCanvas';
import { PracticePad } from './PracticePad';

type Mode = 'trace' | 'practice';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export default function KanjiTraceScreen(): React.ReactNode {
  const { literal, gloss, mode: modeParam } = useLocalSearchParams<{
    literal: string;
    gloss?: string;
    mode?: string;
  }>();
  const isTablet = useIsTablet();
  const { width, height } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>(modeParam === 'practice' ? 'practice' : 'trace');
  // 그리는 동안 스크롤을 꺼서 세로 획이 화면 스크롤로 새지 않게 한다.
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const lockScroll = () => setScrollEnabled(false);
  const unlockScroll = () => setScrollEnabled(true);

  if (!isTablet) {
    return (
      <View style={styles.center}>
        <Text style={styles.tabletIcon}>✎</Text>
        <Text style={styles.tabletTitle}>테블릿 전용 기능</Text>
        <Text style={styles.tabletBody}>
          한자 따라쓰기는 펜으로 쓰기 편한 테블릿에서만 사용할 수 있어요.
        </Text>
      </View>
    );
  }

  const char = literal ?? '';
  const traceSize = clamp(Math.min(width, height) - spacing.lg * 4, 280, 600);
  const gridWidth = Math.min(width - spacing.lg * 2, 820);
  const hint =
    mode === 'trace'
      ? '펜이나 손가락으로 흐린 글자를 따라 써 보세요'
      : '가이드 칸을 따라 쓴 뒤, 아래 빈 연습장에 자유롭게 반복해 보세요';

  return (
    <ScrollView contentContainerStyle={styles.content} scrollEnabled={scrollEnabled}>
      <View style={styles.head}>
        <Text style={styles.literal}>{char}</Text>
        {gloss ? <Text style={styles.gloss} numberOfLines={2}>{gloss}</Text> : null}
      </View>

      <View style={styles.segment}>
        <SegmentButton label="따라쓰기" active={mode === 'trace'} onPress={() => setMode('trace')} />
        <SegmentButton label="연습" active={mode === 'practice'} onPress={() => setMode('practice')} />
      </View>

      <Text style={styles.hint}>{hint}</Text>

      {mode === 'trace' ? (
        <KanjiTraceCanvas literal={char} size={traceSize} onDrawStart={lockScroll} onDrawEnd={unlockScroll} />
      ) : (
        <PracticePad literal={char} width={gridWidth} height={height} onDrawStart={lockScroll} onDrawEnd={unlockScroll} />
      )}
    </ScrollView>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.ReactNode {
  return (
    <Pressable
      style={[styles.segBtn, active && styles.segBtnActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Text style={[styles.segText, active && styles.segTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, alignItems: 'center' },
  head: { alignItems: 'center', gap: spacing.xs },
  literal: { fontSize: 40, lineHeight: 46, fontWeight: fontWeight.medium, color: colors.text },
  gloss: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  hint: { ...typography.small, color: colors.textTertiary, textAlign: 'center' },

  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
  },
  segBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  segBtnActive: { backgroundColor: colors.surface },
  segText: { ...typography.body, color: colors.textSecondary, fontWeight: fontWeight.medium },
  segTextActive: { color: colors.text, fontWeight: fontWeight.semibold },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm, backgroundColor: colors.bg },
  tabletIcon: { fontSize: 48, color: colors.textTertiary },
  tabletTitle: { ...typography.h2, color: colors.text },
  tabletBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center', maxWidth: 320 },
});

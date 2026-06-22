// 회독 학습 화면 — 단어 제시 → 뜻 확인 → 안다/모름. 모름은 즉시 반복, 모름0 = 챕터 완료.
// FSRS와 분리(보상 없음). 진행은 reading_progress에 즉시 영속(재개 가능).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, fontWeight, radius, spacing, typography } from '~/design/tokens';
import { renderKanjiFace } from '~/lib/cardType';
import { useTTS } from '~/hooks/useTTS';
import type { JlptLevel } from '~/types/Card';
import { ReadingEngine, type ReadingState } from './ReadingEngine';
import { buildReadingEngine, resetReadingChapter } from './buildReadingEngine';

export default function ReadingStudyScreen(): React.ReactNode {
  const router = useRouter();
  const params = useLocalSearchParams<{ level: string; chapter: string }>();
  const level = params.level as JlptLevel;
  const chapter = Number(params.chapter);
  const validParams =
    (['N5', 'N4', 'N3', 'N2', 'N1'] as string[]).includes(params.level ?? '') &&
    Number.isInteger(chapter) &&
    chapter >= 1;
  const tts = useTTS();

  const engineRef = useRef<ReadingEngine | null>(null);
  const [state, setState] = useState<ReadingState | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!validParams) {
      router.back();
      return;
    }
    let alive = true;
    void buildReadingEngine().then(async (engine) => {
      engineRef.current = engine;
      const s = await engine.startChapter(level, chapter);
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, [level, chapter, validParams, router]);

  const mark = useCallback(
    async (known: boolean) => {
      const engine = engineRef.current;
      if (!engine || busy) return;
      setBusy(true);
      const s = await engine.mark(known);
      setRevealed(false);
      setState(s);
      setBusy(false);
    },
    [busy],
  );

  if (!state) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (state.phase === 'done') {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.doneMark}>✓</Text>
        <Text style={styles.doneTitle}>
          {level}-{chapter} 완료
        </Text>
        <Text style={styles.doneSub}>{state.total}단어 모두 외웠어요</Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
        >
          <Text style={styles.primaryBtnText}>챕터 목록으로</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryBtn}
          onPress={async () => {
            await resetReadingChapter(level, chapter);
            const engine = engineRef.current;
            if (engine) setState(await engine.startChapter(level, chapter));
          }}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryBtnText}>다시 외우기</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (state.phase === 'passEnd') {
    const remaining = state.total - state.known;
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.doneTitle}>패스 완료</Text>
        <Text style={styles.doneSub}>
          이번 바퀴 맞힘 {state.passTotal - state.wrong} · 모름 {state.wrong}
        </Text>
        <Text style={styles.doneSub}>
          숙달 {state.known}/{state.total} · 남은 {remaining}개
        </Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => {
            const engine = engineRef.current;
            if (engine) void engine.reshuffle().then(setState);
          }}
          accessibilityRole="button"
        >
          <Text style={styles.primaryBtnText}>틀린 것만 다시 섞어 보기 ({remaining})</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.secondaryBtnText}>나가기 (나중에 이어서)</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const w = state.current!;
  const pct = state.passTotal ? (state.passDone / state.passTotal) * 100 : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.counter}>
          {state.passDone}/{state.passTotal}
        </Text>
      </View>

      <View style={styles.cardArea}>
        <Pressable
          onPress={() => tts.speakAudio('word', w.id, w.reading_kana)}
          accessibilityRole="button"
          accessibilityLabel="발음 듣기"
        >
          <Text style={styles.surface}>{renderKanjiFace(w)}</Text>
        </Pressable>

        {revealed ? (
          <>
            {renderKanjiFace(w) !== w.reading_kana && (
              <Text style={styles.reading}>{w.reading_kana}</Text>
            )}
            <Text style={styles.meaning}>{w.meaning_ko}</Text>
          </>
        ) : (
          <Pressable
            style={styles.revealBtn}
            onPress={() => setRevealed(true)}
            accessibilityRole="button"
          >
            <Text style={styles.revealText}>뜻 보기</Text>
          </Pressable>
        )}

        <Pressable
          style={styles.detailLink}
          onPress={() => router.push({ pathname: '/word/[id]', params: { id: w.id } })}
          accessibilityRole="link"
        >
          <Text style={styles.detailLinkText}>단어 상세 · 한자 보기 ↗</Text>
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.markBtn, styles.unknownBtn]}
          onPress={() => void mark(false)}
          disabled={busy}
          accessibilityRole="button"
        >
          <Text style={styles.unknownText}>모름</Text>
        </Pressable>
        <Pressable
          style={[styles.markBtn, styles.knownBtn]}
          onPress={() => void mark(true)}
          disabled={busy}
          accessibilityRole="button"
        >
          <Text style={styles.knownText}>안다</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  close: { ...typography.h2, color: colors.textSecondary },
  bar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.accent },
  counter: { ...typography.small, color: colors.textSecondary, minWidth: 44, textAlign: 'right' },
  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.lg },
  surface: { fontSize: 64, lineHeight: 76, color: colors.text, fontWeight: fontWeight.medium, textAlign: 'center' },
  reading: { ...typography.h2, color: colors.textSecondary, textAlign: 'center' },
  meaning: { ...typography.h2, color: colors.text, textAlign: 'center' },
  revealBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  revealText: { ...typography.body, color: colors.textSecondary },
  detailLink: { paddingVertical: spacing.sm },
  detailLinkText: { ...typography.small, color: colors.textTertiary, fontWeight: fontWeight.medium },
  actions: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  markBtn: { flex: 1, paddingVertical: spacing.lg, borderRadius: radius.pill, alignItems: 'center' },
  unknownBtn: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  unknownText: { ...typography.body, color: colors.text, fontWeight: fontWeight.semibold },
  knownBtn: { backgroundColor: colors.accent },
  knownText: { ...typography.body, color: colors.white, fontWeight: fontWeight.semibold },
  doneMark: { fontSize: 56, color: colors.accent },
  doneTitle: { ...typography.h1, color: colors.text },
  doneSub: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  primaryBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  primaryBtnText: { ...typography.body, color: colors.white, fontWeight: fontWeight.semibold },
  secondaryBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  secondaryBtnText: { ...typography.small, color: colors.textSecondary, fontWeight: fontWeight.medium },
});

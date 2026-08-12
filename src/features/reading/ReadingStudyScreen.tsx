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
import { font, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useColors, useThemedStyles } from '~/design/theme';
import { renderKanjiFace } from '~/lib/cardType';
import { useTTS } from '~/hooks/useTTS';
import type { JlptLevel } from '~/types/Card';
import { ReadingEngine, type ReadingState } from './ReadingEngine';
import { buildReadingEngine, resetReadingChapter } from './buildReadingEngine';

export default function ReadingStudyScreen(): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const c = useColors();
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
        <ActivityIndicator color={c.ink} />
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

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.softer },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  close: { ...typography.resultTitle, color: c.body },
  bar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.soft, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: c.ink },
  counter: { ...typography.caption, color: c.body, minWidth: 44, textAlign: 'right' },
  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl, padding: spacing.xl },
  surface: { fontSize: 64, lineHeight: 76, color: c.ink, fontFamily: font.medium, textAlign: 'center' },
  reading: { ...typography.resultTitle, color: c.body, textAlign: 'center' },
  meaning: { ...typography.resultTitle, color: c.ink, textAlign: 'center' },
  revealBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.pressed,
  },
  revealText: { ...typography.body, color: c.body },
  detailLink: { paddingVertical: spacing.sm },
  detailLinkText: { ...typography.caption, color: c.mute, fontFamily: font.medium },
  actions: { flexDirection: 'row', gap: spacing.lg, padding: spacing.xl },
  markBtn: { flex: 1, paddingVertical: spacing.xl, borderRadius: radius.pill, alignItems: 'center' },
  unknownBtn: { borderWidth: 1, borderColor: c.pressed, backgroundColor: c.canvas },
  unknownText: { ...typography.body, color: c.ink, fontFamily: font.semibold },
  knownBtn: { backgroundColor: c.ink },
  knownText: { ...typography.body, color: c.onInk, fontFamily: font.semibold },
  doneMark: { fontSize: 56, color: c.ink },
  doneTitle: { ...typography.screenTitle, color: c.ink },
  doneSub: { ...typography.body, color: c.body, marginBottom: spacing.xl },
  primaryBtn: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
    backgroundColor: c.ink,
  },
  primaryBtnText: { ...typography.body, color: c.onInk, fontFamily: font.semibold },
  secondaryBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
  secondaryBtnText: { ...typography.caption, color: c.body, fontFamily: font.medium },
});

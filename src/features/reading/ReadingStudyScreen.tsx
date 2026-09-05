// 회독 학습 화면 — review-hub.html: 뜻 보기 후 모름/안다, 끝나면 허브로 돌아간다.
// FSRS와 분리(보상 없음). 진행은 reading_progress에 즉시 영속(재개 가능).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { HTML_FLOW_PAGE, layout, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import { useFullScreenInsets } from '~/hooks/useScreenInsets';
import { useTTS } from '~/hooks/useTTS';
import { preloadInterstitial, showInterstitialIfEligible } from '~/lib/ads/interstitialManager';
import { useSettingsStore } from '~/stores/SettingsStore';
import { StudyProgressHeader } from '~/features/study/components/StudyProgressHeader';
import { StudyActionBar } from '~/features/study/components/StudyActionBar';
import { StudyCard } from '~/features/study/components/StudyCard';
import { revealStudyCard } from '~/features/study/studyRevealAudio';
import type { JlptLevel } from '~/types/Card';
import { ReadingEngine, type ReadingState } from './ReadingEngine';
import { buildReadingEngine, recordReadingPass } from './buildReadingEngine';

export default function ReadingStudyScreen(): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const { colors, name } = useTheme();
  const router = useRouter();
  const screenInsets = useFullScreenInsets();
  const pageStyle = [
    styles.root,
    name === 'light' && { backgroundColor: HTML_FLOW_PAGE },
    { paddingTop: screenInsets.top, paddingBottom: screenInsets.bottom },
  ];
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
  const completionHandled = useRef(false);

  useEffect(() => {
    if (!validParams) {
      router.back();
      return;
    }
    preloadInterstitial();
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

  useEffect(() => {
    if (state?.phase !== 'done' || completionHandled.current) return;
    completionHandled.current = true;
    // 회독 기록을 먼저 저장한 뒤 전역 광고 빈도 캡을 적용한다.
    void recordReadingPass(level, chapter)
      .catch(() => undefined)
      .then(() =>
        showInterstitialIfEligible(() => {
          // replace 는 허브 위에 허브를 한 겹 더 쌓아 뒤로가기가 다시 허브로 갔다.
          // dismissTo 는 스택에 이미 있는 허브까지 되감고 파라미터만 갱신한다.
          router.dismissTo(`/reading?completed=${chapter}` as Href);
        }),
      );
  }, [state?.phase, level, chapter, router]);

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

  // 학습 화면과 같은 공개 규칙 — 최초 공개에서만 상태를 바꾸고 설정에 따라 발음 1회 재생.
  const handleReveal = useCallback(() => {
    const word = state?.current;
    if (!word) return;
    const settings = useSettingsStore.getState();
    revealStudyCard({
      alreadyRevealed: revealed,
      ttsEnabled: settings.ttsEnabled,
      autoPlayWordTts: settings.autoPlayWordTtsOnReveal,
      onReveal: () => setRevealed(true),
      onSpeakWord: () => tts.speakAudio('word', word.id, word.reading_kana),
    });
  }, [revealed, state, tts]);

  if (!state) {
    return (
      <View style={pageStyle}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.body} />
          <Text style={styles.noticeBody}>회독 준비 중…</Text>
        </View>
      </View>
    );
  }

  if (state.phase === 'done') {
    return (
      <View style={pageStyle}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.body} />
          <Text style={styles.noticeBody}>회독 기록 중…</Text>
        </View>
      </View>
    );
  }

  const word = state.current;
  if (!word) {
    return (
      <View style={pageStyle}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.body} />
          <Text style={styles.noticeBody}>다음 단어 준비 중…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={pageStyle}>
      <StudyProgressHeader
        done={state.passDone}
        total={state.passTotal}
        onClose={() => router.dismissTo('/reading' as Href)}
        closeLabel="회독 종료"
        variant="inline"
      />
      <StudyCard
        word={word}
        revealed={revealed}
        onReveal={handleReveal}
        onSpeak={
          tts.enabled
            ? () => tts.speakAudio('word', word.id, word.reading_kana)
            : undefined
        }
        onSpeakExample={
          tts.enabled && word.example_jp
            ? () => tts.speakAudio('example', word.id, word.example_jp)
            : undefined
        }
        onOpenDetail={() => router.push(`/word/${word.id}`)}
      />
      <StudyActionBar
        revealed={revealed}
        onReveal={handleReveal}
        negativeLabel="모름"
        onNegative={() => void mark(false)}
        positiveLabel="안다"
        onPositive={() => void mark(true)}
        disabled={busy}
      />
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.softer },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: layout.gutter,
      gap: spacing.sm,
    },
    noticeBody: { ...typography.body, color: c.body, textAlign: 'center' },
  });

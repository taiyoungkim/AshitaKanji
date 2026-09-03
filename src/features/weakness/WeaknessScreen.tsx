import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { Button } from '~/components/ui/Button';
import { Overline } from '~/components/ui/Surface';
import { HTML_FLOW_PAGE, layout, spacing, typography, type ThemeColors } from '~/design/tokens';
import { recipeImage } from '~/features/onigiri/recipeAssets';
import { useTheme, useThemedStyles } from '~/design/theme';
import { StudyActions } from '~/features/study/components/StudyActions';
import { StudyCard } from '~/features/study/components/StudyCard';
import { StudyProgressHeader } from '~/features/study/components/StudyProgressHeader';
import { RecallStage } from '~/features/study/components/RecallStage';
import { Grade } from '~/types/Grade';
import { useFullScreenInsets } from '~/hooks/useScreenInsets';
import { useTTS } from '~/hooks/useTTS';
import { preloadInterstitial, showInterstitialIfEligible } from '~/lib/ads/interstitialManager';
import { useSettingsStore } from '~/stores/SettingsStore';
import type { CardWithProgress } from '~/types/Card';

import { buildTodayReviewService } from './buildTodayReviewService';
import { buildWeaknessService } from './buildWeaknessService';
import type { TodayReviewService } from './TodayReviewService';
import type { WeaknessService } from './WeaknessService';

const WEAKNESS_LIMIT = 50;

export default function WeaknessScreen(): React.ReactNode {
  const params = useLocalSearchParams<{ source?: string; sessionId?: string }>();
  const router = useRouter();
  const selectedLevels = useSettingsStore((s) => s.selectedLevels);
  const settingsHydrated = useSettingsStore((s) => s._hydrated);
  const tts = useTTS();
  const screenInsets = useFullScreenInsets();
  const { colors, name } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const sourceSessionId = Number(params.sessionId);
  const isTodayReview =
    params.source === 'today' && Number.isInteger(sourceSessionId) && sourceSessionId > 0;

  const weaknessServiceRef = useRef<WeaknessService | null>(null);
  const todayServiceRef = useRef<TodayReviewService | null>(null);
  const reviewSessionIdRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const reviewedCountRef = useRef(0);
  const revealStartRef = useRef<number | null>(null);
  const [queue, setQueue] = useState<CardWithProgress[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  useEffect(() => {
    if (!settingsHydrated) return;
    let cancelled = false;
    void (async () => {
      if (isTodayReview) {
        const service = await buildTodayReviewService();
        const nextQueue = await service.getQueue(sourceSessionId, selectedLevels);
        const reviewSessionId = await service.startSession(sourceSessionId, nextQueue.length);
        if (nextQueue.length === 0) {
          await service.completeSession(reviewSessionId, 0);
          completedRef.current = true;
        }
        if (cancelled) {
          if (!completedRef.current) await service.abandonSession(reviewSessionId, 0);
          return;
        }
        if (nextQueue.length > 0) preloadInterstitial();
        todayServiceRef.current = service;
        reviewSessionIdRef.current = reviewSessionId;
        setQueue(nextQueue);
        return;
      }

      const service = await buildWeaknessService();
      const nextQueue = await service.getWeaknessQueue(selectedLevels, WEAKNESS_LIMIT);
      if (cancelled) return;
      if (nextQueue.length > 0) preloadInterstitial();
      weaknessServiceRef.current = service;
      setQueue(nextQueue);
    })();
    return () => { cancelled = true; };
    // 선택 레벨은 화면 진입 시 고정한다. 진행 중 큐를 중간에 교체하지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsHydrated, isTodayReview, sourceSessionId]);

  useEffect(() => {
    return () => {
      const service = todayServiceRef.current;
      const reviewSessionId = reviewSessionIdRef.current;
      if (service && reviewSessionId && !completedRef.current) {
        void service.abandonSession(reviewSessionId, reviewedCountRef.current);
      }
    };
  }, []);

  const showReveal = useCallback(() => {
    revealStartRef.current = Date.now();
    setRevealed(true);
  }, []);

  const grade = useCallback(
    async (gradeValue: Grade) => {
      const card = queue?.[index];
      if (!card || busy) return;
      const revealMs = revealStartRef.current ? Date.now() - revealStartRef.current : null;
      setBusy(true);

      if (isTodayReview) {
        const service = todayServiceRef.current;
        const reviewSessionId = reviewSessionIdRef.current;
        if (!service || !reviewSessionId) {
          setBusy(false);
          return;
        }
        await service.gradeCard(card, gradeValue, revealMs, reviewSessionId);
        const nextCount = reviewedCount + 1;
        if (nextCount >= queue.length) {
          await service.completeSession(reviewSessionId, nextCount);
          completedRef.current = true;
        }
      } else {
        const service = weaknessServiceRef.current;
        if (!service) {
          setBusy(false);
          return;
        }
        await service.gradeCard(card, gradeValue, revealMs);
      }

      revealStartRef.current = null;
      const nextCount = reviewedCount + 1;
      reviewedCountRef.current = nextCount;
      setReviewedCount(nextCount);
      setRevealed(false);
      if (nextCount >= queue.length) {
        // 마지막 평가까지 저장된 뒤 광고를 거쳐 완료 화면으로 전환한다.
        void showInterstitialIfEligible(() => {
          setIndex((current) => current + 1);
          setBusy(false);
        });
        return;
      }
      setIndex((current) => current + 1);
      setBusy(false);
    },
    [busy, index, isTodayReview, queue, reviewedCount],
  );

  const leave = () => {
    if (isTodayReview) router.replace('/home');
    else router.back();
  };

  const pageBg = name === 'light' && isTodayReview ? HTML_FLOW_PAGE : colors.softer;
  const padded = {
    paddingTop: screenInsets.top,
    paddingBottom: screenInsets.bottom,
    backgroundColor: pageBg,
  };

  if (!settingsHydrated || queue === null) {
    return (
      <View style={[styles.center, padded]}>
        <ActivityIndicator color={colors.body} />
        <Text style={styles.dim}>{isTodayReview ? '오늘 복습 준비 중…' : '약점 단어 모으는 중…'}</Text>
      </View>
    );
  }

  if (queue.length === 0) {
    return (
      <View style={[styles.center, padded]}>
        <Overline>{isTodayReview ? '오늘 학습 복습' : '약점 복습'}</Overline>
        <Text style={styles.title}>{isTodayReview ? '복습할 단어가 없어요' : '약점 단어 없음'}</Text>
        <Text style={styles.dim}>
          {isTodayReview ? '오늘 학습한 단어를 모두 잘 기억했어요.' : '최근 막힌 단어, 헷갈린 단어가 없어요.'}
        </Text>
        <Button label={isTodayReview ? '홈으로' : '돌아가기'} onPress={leave} style={styles.doneButton} />
      </View>
    );
  }

  const card = queue[index];
  if (!card) {
    return (
      <View style={[styles.center, padded]}>
        {isTodayReview ? (
          <>
            {recipeImage('onigiri-001') ? (
              <Image source={recipeImage('onigiri-001')} style={styles.doneArt} resizeMode="contain" />
            ) : null}
            <Text style={styles.title}>오늘 복습 끝!</Text>
            <Text style={styles.dim}>{reviewedCount}개 단어를 다시 익혔어요.</Text>
            <Text style={styles.tally}>
              오늘 복습 <Text style={styles.tallyAccent}>{reviewedCount} / {reviewedCount}</Text> 완료
            </Text>
            <Button label="오늘로 돌아가기" variant="brand" onPress={leave} style={styles.doneButton} />
          </>
        ) : (
          <>
            <Overline>약점 복습</Overline>
            <Text style={styles.title}>약점 복습 완료</Text>
            <Text style={styles.dim}>{reviewedCount}개 다시 봤어요.</Text>
            <Button label="돌아가기" onPress={leave} style={styles.doneButton} />
          </>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, padded]}>
      <StudyProgressHeader
        done={index}
        total={queue.length}
        onClose={leave}
        closeLabel={isTodayReview ? '오늘 복습 종료' : '약점 복습 종료'}
        variant={isTodayReview ? 'inline' : 'stacked'}
      />
      {isTodayReview ? (
        <RecallStage
          surface={card.word.surface}
          reading={card.word.reading_kana}
          meaning={card.word.meaning_ko}
          revealed={revealed}
          onReveal={showReveal}
          onUnknown={() => void grade(Grade.Again)}
          onKnown={() => void grade(Grade.Good)}
          disabled={busy}
        />
      ) : (
        <>
          <StudyCard
            word={card.word}
            revealed={revealed}
            onReveal={showReveal}
            onSpeak={
              tts.enabled
                ? () => tts.speakAudio('word', card.word.id, card.word.reading_kana)
                : undefined
            }
            onSpeakExample={
              tts.enabled && card.word.example_jp
                ? () => tts.speakAudio('example', card.word.id, card.word.example_jp)
                : undefined
            }
            onOpenDetail={() => router.push({ pathname: '/word/[id]', params: { id: card.word.id } })}
          />
          <StudyActions
            revealed={revealed}
            onReveal={showReveal}
            onGrade={(gradeValue) => void grade(gradeValue)}
            disabled={busy}
          />
        </>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.softer },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.softer,
      paddingHorizontal: layout.gutter,
      gap: spacing.sm,
    },
    title: { ...typography.resultTitle, color: c.ink, textAlign: 'center' },
    dim: { ...typography.body, color: c.body, textAlign: 'center' },
    doneArt: { width: 132, height: 132, marginBottom: spacing.sm },
    tally: {
      ...typography.bodyStrong,
      color: c.ink,
      textAlign: 'center',
      backgroundColor: c.canvas,
      borderRadius: 18,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      marginTop: spacing.sm,
    },
    tallyAccent: { color: c.primary },
    doneButton: { alignSelf: 'stretch', marginTop: spacing.xl },
  });

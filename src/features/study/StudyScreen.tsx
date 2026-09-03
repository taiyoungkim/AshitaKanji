// Design Ref: Onikan handoff 화면 2 — 학습 세션 (`1b`).
// Plan SC: "오늘 완료" = 오늘 큐를 모두 비움 → Done.
//
// 리콜(회상) → 공개 → 2단계 자가평가. 닫기·진행바·남은 개수는 상단 헤더가 담당한다.

import { useEffect, useRef } from 'react';
import { useNavigation, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { layout, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import { Overline } from '~/components/ui/Surface';
import { useFullScreenInsets } from '~/hooks/useScreenInsets';
import { useTTS } from '~/hooks/useTTS';
import { preloadInterstitial, showInterstitialIfEligible } from '~/lib/ads/interstitialManager';
import { useSessionStore } from '~/stores/SessionStore';
import { settingsToSessionConfig, useSettingsStore } from '~/stores/SettingsStore';
import { StudyActions } from './components/StudyActions';
import { StudyCard } from './components/StudyCard';
import { StudyHeader } from './components/StudyHeader';
import { revealStudyCard } from './studyRevealAudio';
import {
  resolveStudyMountAction,
  reviewedCountFromSession,
  shouldBlockStudyLeave,
  subscribeToStudyRouteRemoval,
} from './studySessionLifecycle';

export default function StudyScreen(): React.ReactNode {
  const current = useSessionStore((s) => s.current);
  const card = useSessionStore((s) => s.card);
  const reveal = useSessionStore((s) => s.reveal);
  const busy = useSessionStore((s) => s.busy);
  const summary = useSessionStore((s) => s.summary);
  const dataEmpty = useSessionStore((s) => s.dataEmpty);
  const startSession = useSessionStore((s) => s.startSession);
  const submitGrade = useSessionStore((s) => s.submitGrade);
  const endSession = useSessionStore((s) => s.endSession);
  const settingsHydrated = useSettingsStore((s) => s._hydrated);
  const tts = useTTS();
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const screenInsets = useFullScreenInsets();
  const navigatedToDone = useRef(false);

  // 설정 복원(persist) 후 세션 시작 — stale 기본값으로 시작 방지.
  // 이미 진행 중이면 유지하고, 실제 라우트 이탈 시 미완 세션을 정리한다.
  useEffect(() => {
    if (!settingsHydrated) return;
    const action = resolveStudyMountAction(useSessionStore.getState());
    if (action === 'open-done') {
      if (!navigatedToDone.current) {
        navigatedToDone.current = true;
        router.replace('/done');
      }
      return;
    }
    if (action === 'start') {
      const config = settingsToSessionConfig(useSettingsStore.getState());
      void startSession(config);
      preloadInterstitial();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsHydrated]);

  // 회전·구성 변경으로 화면 컴포넌트만 다시 만들어질 때는 진행 중 세션을 유지한다.
  // 사용자가 뒤로 가거나 닫아서 라우트 자체가 제거될 때만 미완 세션을 종료한다.
  useEffect(() => {
    return subscribeToStudyRouteRemoval(
      (listener) => navigation.addListener('beforeRemove', listener),
      () => {
        const session = useSessionStore.getState();
        return {
          engine: session.engine,
          summary: session.summary,
          phase: session.current?.phase ?? null,
          reviewedCount: reviewedCountFromSession(session.current),
          abandon: session.abandon,
        };
      },
    );
  }, [navigation]);

  // 오늘 큐 소진 → 세션 종료 + 요약 산정 → Done 화면(/done)으로 이동.
  // 단, 데이터 미탑재(dataEmpty)면 "끝!"이 아니라 빌드 안내를 보여야 하므로 종료 보류.
  const finished = !!current && !card && current.phase === 'done' && !dataEmpty;
  useEffect(() => {
    if (finished && !summary && !navigatedToDone.current) {
      navigatedToDone.current = true;
      // 세션 기록 저장 먼저(광고 실패와 무관하게 보존) → 캡 통과 시 전면광고 → /done.
      void endSession('completed')
        .then(() => showInterstitialIfEligible(() => router.replace('/done')))
        .catch((err: unknown) => {
          console.warn('[study] complete failed:', err);
          navigatedToDone.current = false;
        });
    }
  }, [finished, summary, endSession, router]);

  // 진행 중 종료는 실수 방지를 위해 확인 다이얼로그. 완료/빈 상태면 바로 닫음.
  const handleClose = () => {
    if (
      shouldBlockStudyLeave({
        summary,
        phase: current?.phase ?? null,
        reviewedCount: reviewedCountFromSession(current),
      })
    ) {
      return;
    }
    const inProgress = !!current && !!card && !summary && !dataEmpty;
    if (!inProgress) {
      router.back();
      return;
    }
    Alert.alert('학습을 종료할까요?', '지금 나가면 이번 세션을 종료합니다.', [
      { text: '계속 학습', style: 'cancel' },
      { text: '종료', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const handleReveal = () => {
    const session = useSessionStore.getState();
    const word = session.card?.word;
    if (!word) return;

    const settings = useSettingsStore.getState();
    revealStudyCard({
      alreadyRevealed: session.reveal,
      ttsEnabled: settings.ttsEnabled,
      autoPlayWordTts: settings.autoPlayWordTtsOnReveal,
      onReveal: session.showReveal,
      onSpeakWord: () => tts.speakAudio('word', word.id, word.reading_kana),
    });
  };

  // 데이터 미탑재 — 빈 큐를 "오늘 끝"으로 오인하지 않게 명시 안내(P0).
  const completing =
    current?.phase === 'done' &&
    !summary &&
    reviewedCountFromSession(current) > 0;
  const notice = dataEmpty
    ? { overline: '데이터 없음', title: '학습 데이터 없음', body: '단어 DB가 아직 탑재되지 않았어요. (assets/jlpt.db 빌드 필요)' }
    : summary || completing
      ? {
          overline: '오늘의 학습',
          title: '오늘 학습 완료',
          body: summary ? '내일 또 만나요.' : '결과를 준비하고 있어요.',
        }
      : !current
        ? null
        : !card
          ? { overline: '오늘의 학습', title: '학습할 카드가 없어요', body: '설정에서 레벨이나 하루 분량을 조정해 보세요.' }
          : null;

  return (
    <View style={[styles.root, { paddingTop: screenInsets.top, paddingBottom: screenInsets.bottom }]}>
      {current && card && !summary ? (
        <>
          <StudyHeader state={current} onClose={handleClose} />
          <StudyCard
            word={card.word}
            revealed={reveal}
            onReveal={handleReveal}
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
            onOpenDetail={() => router.push(`/word/${card.word.id}`)}
          />
          <StudyActions
            revealed={reveal}
            onReveal={handleReveal}
            onGrade={(g) => void submitGrade(g)}
            disabled={busy}
          />
        </>
      ) : notice ? (
        <View style={styles.center}>
          <Overline>{notice.overline}</Overline>
          <Text style={styles.noticeTitle}>{notice.title}</Text>
          <Text style={styles.noticeBody}>{notice.body}</Text>
        </View>
      ) : (
        <View style={styles.center}>
          <ActivityIndicator color={colors.body} />
          <Text style={styles.noticeBody}>세션 준비 중…</Text>
        </View>
      )}
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
    noticeTitle: { ...typography.resultTitle, color: c.ink, textAlign: 'center' },
    noticeBody: { ...typography.body, color: c.body, textAlign: 'center' },
  });

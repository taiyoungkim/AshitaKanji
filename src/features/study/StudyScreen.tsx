// Design Ref: Onikan handoff 화면 2 — 학습 세션 (`1b`).
// Plan SC: "오늘 완료" = 오늘 큐를 모두 비움 → Done.
//
// 리콜(회상) → 공개 → 2단계 자가평가. 닫기·진행바·남은 개수는 상단 헤더가 담당한다.

import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';
import { layout, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import { Overline } from '~/components/ui/Surface';
import { useTTS } from '~/hooks/useTTS';
import { preloadInterstitial, showInterstitialIfEligible } from '~/lib/ads/interstitialManager';
import { useSessionStore } from '~/stores/SessionStore';
import { settingsToSessionConfig, useSettingsStore } from '~/stores/SettingsStore';
import { StudyActions } from './components/StudyActions';
import { StudyCard } from './components/StudyCard';
import { StudyHeader } from './components/StudyHeader';

// fullScreenModal 안에서는 useSafeAreaInsets()가 0을 주는 경우가 있어,
// 디바이스 실제 inset(상태바/노치·홈 인디케이터)을 직접 사용한다.
const TOP_INSET = initialWindowMetrics?.insets.top ?? 24;
const BOTTOM_INSET = initialWindowMetrics?.insets.bottom ?? 0;

export default function StudyScreen(): React.ReactNode {
  const engine = useSessionStore((s) => s.engine);
  const current = useSessionStore((s) => s.current);
  const card = useSessionStore((s) => s.card);
  const reveal = useSessionStore((s) => s.reveal);
  const busy = useSessionStore((s) => s.busy);
  const summary = useSessionStore((s) => s.summary);
  const dataEmpty = useSessionStore((s) => s.dataEmpty);
  const startSession = useSessionStore((s) => s.startSession);
  const showReveal = useSessionStore((s) => s.showReveal);
  const submitGrade = useSessionStore((s) => s.submitGrade);
  const endSession = useSessionStore((s) => s.endSession);
  const abandon = useSessionStore((s) => s.abandon);
  const settingsHydrated = useSettingsStore((s) => s._hydrated);
  const tts = useTTS();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const navigatedToDone = useRef(false);

  // 설정 복원(persist) 후 세션 시작 — stale 기본값으로 시작 방지.
  // 이미 진행 중이면 유지. 언마운트 시 미완 세션은 abandoned 로 기록 후 정리.
  useEffect(() => {
    if (settingsHydrated && !engine) {
      const config = settingsToSessionConfig(useSettingsStore.getState());
      void startSession(config);
      // 전면광고 미리 로드 — 완료 시점(/done 전환)에 표시. 로드엔 수 초 필요.
      preloadInterstitial();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsHydrated]);

  useEffect(() => {
    return () => {
      void abandon();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 오늘 큐 소진 → 세션 종료 + 요약 산정 → Done 화면(/done)으로 이동.
  // 단, 데이터 미탑재(dataEmpty)면 "끝!"이 아니라 빌드 안내를 보여야 하므로 종료 보류.
  const finished = !!current && !card && current.phase === 'done' && !dataEmpty;
  useEffect(() => {
    if (finished && !summary && !navigatedToDone.current) {
      navigatedToDone.current = true;
      // 세션 기록 저장 먼저(광고 실패와 무관하게 보존) → 캡 통과 시 전면광고 → /done.
      void endSession('completed').then(() =>
        showInterstitialIfEligible(() => router.replace('/done')),
      );
    }
  }, [finished, summary, endSession, router]);

  // 진행 중 종료는 실수 방지를 위해 확인 다이얼로그. 완료/빈 상태면 바로 닫음.
  const handleClose = () => {
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

  // 데이터 미탑재 — 빈 큐를 "오늘 끝"으로 오인하지 않게 명시 안내(P0).
  const notice = dataEmpty
    ? { overline: '데이터 없음', title: '학습 데이터 없음', body: '단어 DB가 아직 탑재되지 않았어요. (assets/jlpt.db 빌드 필요)' }
    : summary
      ? { overline: '오늘의 학습', title: '오늘 학습 완료', body: '내일 또 만나요.' }
      : !current
        ? null
        : !card
          ? { overline: '오늘의 학습', title: '학습할 카드가 없어요', body: '설정에서 레벨이나 하루 분량을 조정해 보세요.' }
          : null;

  return (
    <View style={[styles.root, { paddingTop: TOP_INSET, paddingBottom: BOTTOM_INSET }]}>
      {current && card && !summary ? (
        <>
          <StudyHeader state={current} onClose={handleClose} />
          <StudyCard
            word={card.word}
            revealed={reveal}
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
            onOpenDetail={() => router.push(`/word/${card.word.id}`)}
          />
          <StudyActions
            revealed={reveal}
            onReveal={showReveal}
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

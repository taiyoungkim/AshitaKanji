// Design Ref: §5.2 Card UX + §6.1 SessionStore — 학습 화면 (한자 → reveal → 4-grade).
// Plan SC: "오늘 완료" = Main + Again 미니라운드 모두 비움 → Done.
//
// MVP: 탭만 (swipe 제스처는 V1.1 — Design §12 Open Question).
// TTS(onSpeak)는 module-10, DoneScreen 애니메이션은 module-8 에서 확장.

import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { Card } from '~/components/card/Card';
import { useTTS } from '~/hooks/useTTS';
import { useSessionStore } from '~/stores/SessionStore';
import { settingsToSessionConfig, useSettingsStore } from '~/stores/SettingsStore';
import { GradeButtons } from './components/GradeButtons';
import { RevealButton } from './components/RevealButton';
import { SessionProgress } from './components/SessionProgress';

// fullScreenModal 안에서는 useSafeAreaInsets()가 0을 주는 경우가 있어,
// 디바이스 실제 top inset(상태바/노치 높이)을 직접 사용해 ✕를 상단바 아래로 내림.
const TOP_INSET = initialWindowMetrics?.insets.top ?? 24;

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
  const navigatedToDone = useRef(false);

  // 설정 복원(persist) 후 세션 시작 — stale 기본값으로 시작 방지.
  // 이미 진행 중이면 유지. 언마운트 시 미완 세션은 abandoned 로 기록 후 정리.
  useEffect(() => {
    if (settingsHydrated && !engine) {
      const config = settingsToSessionConfig(useSettingsStore.getState());
      void startSession(config);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsHydrated]);

  useEffect(() => {
    return () => {
      void abandon();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Main + Again 라운드 소진 → 세션 종료 + 요약 산정 → Done 화면(/done)으로 이동.
  // 단, 데이터 미탑재(dataEmpty)면 "끝!"이 아니라 빌드 안내를 보여야 하므로 종료 보류.
  const finished = !!current && !card && current.phase === 'done' && !dataEmpty;
  useEffect(() => {
    if (finished && !summary && !navigatedToDone.current) {
      navigatedToDone.current = true;
      void endSession('completed').then(() => router.push('/done'));
    }
  }, [finished, summary, endSession, router]);

  // 데이터 미탑재 — 빈 큐를 "오늘 끝"으로 오인하지 않게 명시 안내(P0).
  let body: React.ReactNode;
  if (dataEmpty) {
    body = (
      <View style={styles.center}>
        <Text style={styles.emoji}>📦</Text>
        <Text style={styles.doneTitle}>학습 데이터 없음</Text>
        <Text style={styles.dim}>
          단어 DB가 아직 탑재되지 않았어요. (assets/jlpt.db 빌드 필요)
        </Text>
      </View>
    );
  } else if (!current) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0366d6" />
        <Text style={styles.dim}>세션 준비 중…</Text>
      </View>
    );
  } else if (summary) {
    // 큰 축하 애니메이션은 /done 모달이 담당 — 복귀 시엔 간단 완료 표시.
    body = (
      <View style={styles.center}>
        <Text style={styles.emoji}>✅</Text>
        <Text style={styles.doneTitle}>오늘 학습 완료</Text>
        <Text style={styles.dim}>내일 또 만나요.</Text>
      </View>
    );
  } else if (!card) {
    body = (
      <View style={styles.center}>
        <Text style={styles.dim}>오늘 학습할 카드가 없어요.</Text>
      </View>
    );
  } else {
    body = (
      <View style={styles.container}>
        <SessionProgress state={current} />
        <Card
          word={card.word}
          revealed={reveal}
          onReveal={showReveal}
          onSpeak={tts.enabled ? () => tts.speak(card.word.reading_kana) : undefined}
          onOpenDetail={() => router.push(`/word/${card.word.id}`)}
        />
        {reveal ? (
          <GradeButtons onGrade={(g) => void submitGrade(g)} disabled={busy} />
        ) : (
          <RevealButton onPress={showReveal} />
        )}
      </View>
    );
  }

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

  // 풀스크린 몰입 — 탭바/헤더 없음. 상단 ✕ 로 중도 종료(확인 후 언마운트 시 abandon).
  return (
    <SafeAreaView style={styles.fill} edges={['bottom']}>
      <View style={[styles.topBar, { paddingTop: TOP_INSET }]}>
        <Pressable
          style={styles.closeBtn}
          onPress={handleClose}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel="학습 종료"
        >
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>
      </View>
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#f5f5f7' },
  topBar: { paddingHorizontal: 8, paddingBottom: 4 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { fontSize: 22, color: '#555', fontWeight: '600' },
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  dim: { fontSize: 14, color: '#888' },
  emoji: { fontSize: 56 },
  doneTitle: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
});

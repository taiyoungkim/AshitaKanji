// Design Ref: §5.2 Card UX + §6.1 SessionStore — 학습 화면 (한자 → reveal → 4-grade).
// Plan SC: "오늘 완료" = Main + Again 미니라운드 모두 비움 → Done.
//
// MVP: 탭만 (swipe 제스처는 V1.1 — Design §12 Open Question).
// TTS(onSpeak)는 module-10, DoneScreen 애니메이션은 module-8 에서 확장.

import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Card } from '~/components/card/Card';
import { useTTS } from '~/hooks/useTTS';
import { useSessionStore } from '~/stores/SessionStore';
import { settingsToSessionConfig, useSettingsStore } from '~/stores/SettingsStore';
import { GradeButtons } from './components/GradeButtons';
import { RevealButton } from './components/RevealButton';
import { SessionProgress } from './components/SessionProgress';

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
  if (dataEmpty) {
    return (
      <View style={styles.center}>
        <Text style={styles.emoji}>📦</Text>
        <Text style={styles.doneTitle}>학습 데이터 없음</Text>
        <Text style={styles.dim}>
          단어 DB가 아직 탑재되지 않았어요. (assets/jlpt.db 빌드 필요)
        </Text>
      </View>
    );
  }

  if (!current) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0366d6" />
        <Text style={styles.dim}>세션 준비 중…</Text>
      </View>
    );
  }

  if (summary) {
    // 큰 축하 애니메이션은 /done 모달이 담당 — 탭으로 복귀 시엔 간단 완료 표시.
    return (
      <View style={styles.center}>
        <Text style={styles.emoji}>✅</Text>
        <Text style={styles.doneTitle}>오늘 학습 완료</Text>
        <Text style={styles.dim}>내일 또 만나요.</Text>
      </View>
    );
  }

  if (!card) {
    return (
      <View style={styles.center}>
        <Text style={styles.dim}>오늘 학습할 카드가 없어요.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SessionProgress state={current} />
      <Card
        word={card.word}
        revealed={reveal}
        onReveal={showReveal}
        onSpeak={tts.enabled ? () => tts.speak(card.word.reading_kana) : undefined}
      />
      {reveal ? (
        <GradeButtons onGrade={(g) => void submitGrade(g)} disabled={busy} />
      ) : (
        <RevealButton onPress={showReveal} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  dim: { fontSize: 14, color: '#888' },
  emoji: { fontSize: 56 },
  doneTitle: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
});

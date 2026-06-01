// Design Ref: §4.4 WeaknessService + §5.4 약점만 다시 보기 — 신규 증가 X 복습 루프.
// Plan SC: 약점 큐(leech/최근 Again/느린 reveal/scan 미편입) 카드만 reveal→4-grade.
//
// SessionEngine 미사용 (신규 큐 로직 불필요) — 약점 큐 위에서 직접 FsrsScheduler 재스케줄.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, fontWeight, spacing, typography } from '~/design/tokens';
import { Card } from '~/components/card/Card';
import { useTTS } from '~/hooks/useTTS';
import { useSettingsStore } from '~/stores/SettingsStore';
import type { CardWithProgress } from '~/types/Card';
import type { Grade } from '~/types/Grade';
import { GradeButtons } from '~/features/study/components/GradeButtons';
import { RevealButton } from '~/features/study/components/RevealButton';
import { buildWeaknessService } from './buildWeaknessService';
import type { WeaknessService } from './WeaknessService';

const WEAKNESS_LIMIT = 50;

export default function WeaknessScreen(): React.ReactNode {
  const selectedLevels = useSettingsStore((s) => s.selectedLevels);
  const settingsHydrated = useSettingsStore((s) => s._hydrated);
  const tts = useTTS();

  const serviceRef = useRef<WeaknessService | null>(null);
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
      const svc = await buildWeaknessService();
      const q = await svc.getWeaknessQueue(selectedLevels, WEAKNESS_LIMIT);
      if (cancelled) return;
      serviceRef.current = svc;
      setQueue(q);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsHydrated]);

  const showReveal = useCallback(() => {
    revealStartRef.current = Date.now();
    setRevealed(true);
  }, []);

  const grade = useCallback(
    async (g: Grade) => {
      const svc = serviceRef.current;
      const card = queue?.[index];
      if (!svc || !card || busy) return;
      setBusy(true);
      const revealMs = revealStartRef.current
        ? Date.now() - revealStartRef.current
        : null;
      await svc.gradeCard(card, g, revealMs);
      revealStartRef.current = null;
      setReviewedCount((n) => n + 1);
      setRevealed(false);
      setIndex((i) => i + 1);
      setBusy(false);
    },
    [queue, index, busy],
  );

  if (!settingsHydrated || queue === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.text} />
        <Text style={styles.dim}>약점 단어 모으는 중…</Text>
      </View>
    );
  }

  if (queue.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.kicker}>ALL CLEAR</Text>
        <Text style={styles.title}>약점 단어 없음</Text>
        <Text style={styles.dim}>
          최근 막힌 단어, 헷갈린 단어가 없어요.{'\n'}꾸준히 잘하고 있다는 뜻!
        </Text>
      </View>
    );
  }

  const card = queue[index];
  if (!card) {
    return (
      <View style={styles.center}>
        <Text style={styles.kicker}>COMPLETED</Text>
        <Text style={styles.title}>약점 복습 완료</Text>
        <Text style={styles.dim}>{reviewedCount}개 다시 봤어요.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        약점 {index + 1} / {queue.length}
      </Text>
      <Card
        word={card.word}
        revealed={revealed}
        onReveal={showReveal}
        onSpeak={tts.enabled ? () => tts.speak(card.word.reading_kana) : undefined}
      />
      {revealed ? (
        <GradeButtons onGrade={(g) => void grade(g)} disabled={busy} />
      ) : (
        <RevealButton onPress={showReveal} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  dim: { ...typography.small, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  kicker: { ...typography.tiny, color: colors.textSecondary, marginBottom: spacing.sm },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.xs },
  progress: {
    textAlign: 'center',
    marginTop: spacing.md,
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
});

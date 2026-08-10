// Design Ref: §4.4 WeaknessService + Onikan 화면 2(`1b`) 재사용 — 신규 증가 X 복습 루프.
// Plan SC: 약점 큐(leech/최근 Again/느린 reveal/scan 미편입) 카드만 reveal→평가.
//
// SessionEngine 미사용 (신규 큐 로직 불필요) — 약점 큐 위에서 직접 FsrsScheduler 재스케줄.
// 평가는 학습 세션과 같은 2단계를 쓴다 — 화면마다 판단 기준이 달라지면 안 된다.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { layout, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import { Overline } from '~/components/ui/Surface';
import { useTTS } from '~/hooks/useTTS';
import { useSettingsStore } from '~/stores/SettingsStore';
import type { CardWithProgress } from '~/types/Card';
import type { Grade } from '~/types/Grade';
import { StudyActions } from '~/features/study/components/StudyActions';
import { StudyCard } from '~/features/study/components/StudyCard';
import { buildWeaknessService } from './buildWeaknessService';
import type { WeaknessService } from './WeaknessService';

const WEAKNESS_LIMIT = 50;

export default function WeaknessScreen(): React.ReactNode {
  const selectedLevels = useSettingsStore((s) => s.selectedLevels);
  const settingsHydrated = useSettingsStore((s) => s._hydrated);
  const tts = useTTS();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

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
      const revealMs = revealStartRef.current ? Date.now() - revealStartRef.current : null;
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
        <ActivityIndicator color={colors.body} />
        <Text style={styles.dim}>약점 단어 모으는 중…</Text>
      </View>
    );
  }

  if (queue.length === 0) {
    return (
      <View style={styles.center}>
        <Overline>약점 복습</Overline>
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
        <Overline>약점 복습</Overline>
        <Text style={styles.title}>약점 복습 완료</Text>
        <Text style={styles.dim}>{reviewedCount}개 다시 봤어요.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        <View style={styles.track}>
          {queue.map((c, i) => (
            <View
              key={c.word.id}
              style={[styles.cell, { backgroundColor: i < index ? colors.ink : colors.pressed }]}
            />
          ))}
        </View>
        <Text style={styles.progressCount}>{queue.length - index}개 남음</Text>
      </View>
      <StudyCard
        word={card.word}
        revealed={revealed}
        onReveal={showReveal}
        onSpeak={tts.enabled ? () => tts.speak(card.word.reading_kana) : undefined}
      />
      <StudyActions
        revealed={revealed}
        onReveal={showReveal}
        onGrade={(g) => void grade(g)}
        disabled={busy}
      />
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
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: layout.gapTight,
      paddingTop: spacing.lg,
      paddingHorizontal: layout.gutter,
    },
    track: { flex: 1, flexDirection: 'row', gap: spacing.xs },
    cell: { flex: 1, height: 4, borderRadius: radius.pill },
    progressCount: { ...typography.captionStrong, color: c.body },
  });

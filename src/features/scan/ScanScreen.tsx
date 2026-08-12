// Design Ref: §4.3 ScanService + §5.4/§5 빠른 훑기 — 분류 → SRS 편입 추천.
// Plan SC: 50/100/200/300 랜덤(verified), 4분류(안다/헷갈림/모름/나중에),
//          종료 후 모름>헷갈림 우선 추천(기본 30, 최대 50) 선택 편입.
//
// 25개 청크 스트리밍: 카드를 한 장씩 렌더 (전체 풀은 메모리에 있으나 1장만 표시).
// 리디자인: 무채색·플랫. 분류 버튼은 색상 대신 농도 램프로 위계 표현.

import { useCallback, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { font, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useColors, useThemedStyles } from '~/design/theme';
import type { Word } from '~/types/Card';
import type { ScanGrade, ScanSummary } from '~/types/ScanResult';
import { useSettingsStore } from '~/stores/SettingsStore';
import { buildScanService } from './buildScanService';
import {
  SCAN_RECOMMEND_DEFAULT,
  SCAN_RECOMMEND_MAX,
  type ScanService,
} from './ScanService';

type BatchSize = 50 | 100 | 200 | 300;
const BATCH_OPTIONS: BatchSize[] = [50, 100, 200, 300];
type Phase = 'config' | 'loading' | 'scanning' | 'summary';

// 등급 버튼은 색 코딩 대신 잉크 농도 램프로 위계를 만든다 — 오렌지는 주요 액션 전용.
const GRADE_LABELS: { grade: ScanGrade; label: string }[] = [
  { grade: 'known', label: '안다' },
  { grade: 'confused', label: '헷갈림' },
  { grade: 'unknown', label: '모름' },
  { grade: 'later', label: '나중에' },
];

function gradeStyles(c: ThemeColors): Record<ScanGrade, { fill: ViewStyle; text: TextStyle }> {
  return {
    known: { fill: { backgroundColor: c.ink, borderColor: c.ink }, text: { color: c.onInk } },
    confused: { fill: { backgroundColor: c.pressed, borderColor: c.pressed }, text: { color: c.ink } },
    unknown: { fill: { backgroundColor: c.soft, borderColor: c.soft }, text: { color: c.ink } },
    later: { fill: { backgroundColor: 'transparent', borderColor: c.pressed }, text: { color: c.body } },
  };
}

export default function ScanScreen(): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const c = useColors();
  const grades = gradeStyles(c);
  const params = useLocalSearchParams<{ size?: string }>();
  const router = useRouter();
  const selectedLevels = useSettingsStore((s) => s.selectedLevels);

  const serviceRef = useRef<ScanService | null>(null);
  const paramSize = Number(params.size);
  const initialSize: BatchSize | null = BATCH_OPTIONS.includes(paramSize as BatchSize)
    ? (paramSize as BatchSize)
    : null;

  const [phase, setPhase] = useState<Phase>(initialSize ? 'loading' : 'config');
  const [cards, setCards] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [promoting, setPromoting] = useState(false);
  const [promotedCount, setPromotedCount] = useState<number | null>(null);

  const start = useCallback(
    async (size: BatchSize) => {
      setPhase('loading');
      const svc = serviceRef.current ?? (await buildScanService());
      serviceRef.current = svc;
      const session = await svc.startScan(selectedLevels, size);
      setCards(session.cards);
      setIndex(0);
      if (session.cards.length === 0) {
        // 데이터 미탑재 → 빈 요약.
        const s = await svc.endScan();
        setSummary(s);
        setSelected(new Set());
        setPhase('summary');
        return;
      }
      setPhase('scanning');
    },
    [selectedLevels],
  );

  // size 파라미터로 진입 시 자동 시작 (한 번).
  const autoStarted = useRef(false);
  if (initialSize && !autoStarted.current && phase === 'loading') {
    autoStarted.current = true;
    void start(initialSize);
  }

  const classify = useCallback(
    async (grade: ScanGrade) => {
      const svc = serviceRef.current;
      const card = cards[index];
      if (!svc || !card) return;
      await svc.submitScanGrade(card.id, grade);
      const nextIndex = index + 1;
      if (nextIndex >= cards.length) {
        const s = await svc.endScan();
        setSummary(s);
        // 기본 추천 사전 선택 (앞 30개).
        setSelected(new Set(s.recommendedWordIds.slice(0, SCAN_RECOMMEND_DEFAULT)));
        setPhase('summary');
      } else {
        setIndex(nextIndex);
      }
    },
    [cards, index],
  );

  const toggleSelect = useCallback((wordId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(wordId)) next.delete(wordId);
      else if (next.size < SCAN_RECOMMEND_MAX) next.add(wordId);
      return next;
    });
  }, []);

  const promote = useCallback(async () => {
    const svc = serviceRef.current;
    if (!svc) return;
    setPromoting(true);
    const ids = [...selected];
    await svc.promoteToSrs(ids);
    setPromotedCount(ids.length);
    setPromoting(false);
  }, [selected]);

  // ── config ──────────────────────────────────────────────
  if (phase === 'config') {
    return (
      <SafeAreaView style={styles.root} edges={['bottom']}>
        <View style={styles.center}>
          <Text style={styles.h1}>빠른 훑기</Text>
          <Text style={styles.dim}>
            많은 단어를 빠르게 넘기며 아는 것/모르는 것을 분류해요.{'\n'}모름·헷갈림만 골라
            복습 큐에 넣습니다.
          </Text>
          <Text style={styles.label}>몇 개 볼까요?</Text>
          <View style={styles.batchRow}>
            {BATCH_OPTIONS.map((n) => (
              <Pressable
                key={n}
                style={styles.batchChip}
                onPress={() => void start(n)}
                accessibilityRole="button"
              >
                <Text style={styles.batchText}>{n}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── loading ─────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.root} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={c.ink} />
          <Text style={styles.dim}>단어 불러오는 중…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── summary ─────────────────────────────────────────────
  if (phase === 'summary' && summary) {
    if (promotedCount !== null) {
      return (
        <SafeAreaView style={styles.root} edges={['bottom']}>
          <View style={styles.center}>
            <Text style={styles.kicker}>ADDED</Text>
            <Text style={styles.h1}>{promotedCount}개 복습 큐 추가</Text>
            <Text style={styles.dim}>학습 탭에서 이어서 외워보세요.</Text>
            <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
              <Text style={styles.primaryText}>닫기</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }
    const candidates = cards.filter((c) => summary.recommendedWordIds.includes(c.id));
    return (
      <SafeAreaView style={styles.root} edges={['bottom']}>
        <ScrollView style={styles.container} contentContainerStyle={styles.summaryContent}>
          <Text style={styles.h1}>훑기 완료</Text>
          <Text style={styles.dim}>
            안다 {summary.knownCount} · 헷갈림 {summary.confusedCount} · 모름{' '}
            {summary.unknownCount} · 나중에 {summary.laterCount}
          </Text>
          {candidates.length === 0 ? (
            <Text style={styles.dim}>편입할 모름·헷갈림 단어가 없어요. 잘하고 있어요!</Text>
          ) : (
            <>
              <Text style={styles.label}>
                복습 큐에 넣을 단어 ({selected.size}/{SCAN_RECOMMEND_MAX})
              </Text>
              {candidates.map((c) => {
                const on = selected.has(c.id);
                return (
                  <Pressable
                    key={c.id}
                    style={[styles.candRow, on && styles.candRowOn]}
                    onPress={() => toggleSelect(c.id)}
                  >
                    <Text style={styles.candCheck}>{on ? '☑' : '☐'}</Text>
                    <View style={styles.candText}>
                      <Text style={styles.candSurface}>{c.surface}</Text>
                      <Text style={styles.candMeaning}>{c.meaning_ko}</Text>
                    </View>
                  </Pressable>
                );
              })}
              <Pressable
                style={[styles.primaryBtn, (promoting || selected.size === 0) && styles.btnOff]}
                onPress={() => void promote()}
                disabled={promoting || selected.size === 0}
              >
                <Text style={styles.primaryText}>
                  {promoting ? '추가 중…' : `${selected.size}개 복습 큐에 추가`}
                </Text>
              </Pressable>
            </>
          )}
          <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
            <Text style={styles.ghostText}>나가기</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── scanning ────────────────────────────────────────────
  const card = cards[index];
  if (!card) {
    return (
      <SafeAreaView style={styles.root} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={c.ink} />
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <View style={styles.container}>
        <Text style={styles.progress}>
          {index + 1} / {cards.length}
        </Text>
        <View style={styles.scanCard}>
          <Text style={styles.scanSurface}>{card.surface}</Text>
          <Text style={styles.scanReading}>{card.reading_kana}</Text>
          <Text style={styles.scanMeaning}>{card.meaning_ko}</Text>
        </View>
        <View style={styles.gradeRow}>
          {GRADE_LABELS.map((g) => {
            const tone = grades[g.grade];
            return (
              <Pressable
                key={g.grade}
                style={[styles.gradeBtn, tone.fill]}
                onPress={() => void classify(g.grade)}
                accessibilityRole="button"
                accessibilityLabel={g.label}
              >
                <Text style={[styles.gradeText, tone.text]}>{g.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: c.softer },
  container: { flex: 1, backgroundColor: c.softer },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  summaryContent: { padding: spacing.xl, gap: spacing.lg },
  h1: { ...typography.resultTitle, color: c.ink, textAlign: 'center' },
  kicker: { ...typography.overline, color: c.body },
  dim: { ...typography.caption, color: c.body, textAlign: 'center', lineHeight: 20 },
  label: {
    ...typography.body,
    fontFamily: font.medium,
    color: c.ink,
    marginTop: spacing.lg,
  },
  batchRow: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap', justifyContent: 'center' },
  batchChip: {
    width: 72,
    height: 72,
    borderRadius: radius.card,
    backgroundColor: c.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  batchText: { fontSize: 22, lineHeight: 26, fontFamily: font.medium, color: c.onInk },
  progress: {
    textAlign: 'center',
    marginTop: spacing.lg,
    ...typography.caption,
    fontFamily: font.regular,
    color: c.body,
  },
  scanCard: {
    flex: 1,
    margin: spacing.xl,
    backgroundColor: c.canvas,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: c.pressed,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  scanSurface: { fontSize: 52, lineHeight: 58, fontFamily: font.medium, color: c.ink, letterSpacing: -1 },
  scanReading: { fontSize: 22, lineHeight: 28, color: c.body },
  scanMeaning: { ...typography.body, color: c.body, paddingHorizontal: spacing.xl, textAlign: 'center' },
  gradeRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.xl },
  gradeBtn: { flex: 1, paddingVertical: 16, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center' },
  gradeText: { ...typography.caption, fontFamily: font.medium },
  candRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.skeleton,
    borderWidth: 1,
    borderColor: c.pressed,
    backgroundColor: c.canvas,
  },
  candRowOn: { borderColor: c.ink },
  candCheck: { fontSize: 22, color: c.ink },
  candText: { flex: 1 },
  candSurface: { ...typography.body, fontFamily: font.medium, color: c.ink },
  candMeaning: { ...typography.caption, color: c.body },
  primaryBtn: {
    backgroundColor: c.primary,
    borderRadius: radius.pill,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  primaryText: { ...typography.cta, color: c.onPrimary },
  btnOff: { opacity: 0.4 },
  ghostBtn: { paddingVertical: 14, alignItems: 'center' },
  ghostText: { ...typography.body, color: c.body },
});

// Design Ref: §5.4 Home(오늘) — 오늘 할 일(복습+신규) + 더 공부하기(새단어/빠른훑기/약점).
// Plan SC: 빠른 훑기 50/100/200/300, 약점 복습, 일일 신규 프리셋. 학습 데이터 외부 송신 없음.
//
// 카운트는 읽기 전용 집계 (FSRS 상태 변경 없음). 탭 재포커스 시 갱신.

import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDatabase } from '~/db/open';
import { SqliteCardRepo } from '~/db/repos/sqlite/SqliteCardRepo';
import { SqliteUserCardRepo } from '~/db/repos/sqlite/SqliteUserCardRepo';
import { useSettingsStore } from '~/stores/SettingsStore';
import type { JlptLevel } from '~/types/Card';

const NEW_PRESETS = [5, 12, 20, 30, 50] as const;

interface TodayCounts {
  due: number;
  newAvail: number;
}

async function loadTodayCounts(levels: JlptLevel[], dailyNewLimit: number): Promise<TodayCounts> {
  const db = await getDatabase();
  const ucRepo = new SqliteUserCardRepo(db);
  const cardRepo = new SqliteCardRepo(db);
  const now = Date.now();

  const due = await ucRepo.findAllDue(now);
  const dueWords = await cardRepo.findByIds(due.map((c) => c.word_id));
  const levelSet = new Set(levels);
  const dueCount = dueWords.filter((w) => w.deprecated === 0 && levelSet.has(w.level)).length;

  const existing = await ucRepo.existingWordIds();
  const newCands = await cardRepo.findNewCandidates(levels, dailyNewLimit, existing);

  return { due: dueCount, newAvail: newCands.length };
}

export default function HomeScreen(): React.ReactNode {
  const router = useRouter();
  const selectedLevels = useSettingsStore((s) => s.selectedLevels);
  const dailyNewLimit = useSettingsStore((s) => s.dailyNewLimit);
  const setDailyNewLimit = useSettingsStore((s) => s.setDailyNewLimit);
  const hydrated = useSettingsStore((s) => s._hydrated);
  const [counts, setCounts] = useState<TodayCounts | null>(null);

  // 탭 재포커스마다 카운트 재계산 (세션 종료 후 반영).
  useFocusEffect(
    useCallback(() => {
      if (!hydrated) return;
      let alive = true;
      setCounts(null);
      void loadTodayCounts(selectedLevels, dailyNewLimit)
        .then((c) => {
          if (alive) setCounts(c);
        })
        .catch(() => {
          if (alive) setCounts({ due: 0, newAvail: 0 });
        });
      return () => {
        alive = false;
      };
    }, [hydrated, selectedLevels, dailyNewLimit]),
  );

  const newPlanned = counts ? Math.min(counts.newAvail, dailyNewLimit) : 0;
  const todayTotal = counts ? counts.due + newPlanned : 0;
  const allClear = !!counts && todayTotal === 0;
  const canStart = todayTotal > 0;

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.h1}>오늘</Text>
        <Text style={styles.levelsHint}>{selectedLevels.join(' · ')}</Text>

        {/* 오늘 할 일 — 칩 선택에 따라 숫자가 실시간 반영 */}
        <View style={styles.heroCard}>
          {!counts ? (
            <ActivityIndicator color="#0366d6" />
          ) : (
            <>
              <Text style={styles.heroLabel}>오늘 할 일</Text>
              <View style={styles.heroCounts}>
                <HeroCount value={counts.due} label="복습" />
                <Text style={styles.heroPlus}>+</Text>
                <HeroCount value={newPlanned} label="새 단어" />
              </View>
              {allClear && (
                <Text style={styles.heroSub}>
                  복습할 게 없어요. 아래에서 새 단어 수를 골라 시작하세요.
                </Text>
              )}
            </>
          )}
        </View>

        {/* 더 공부하기 */}
        <Section title="더 공부하기">
          <Text style={styles.subLabel}>새 단어 외우기</Text>
          <View style={styles.chipRow}>
            {NEW_PRESETS.map((n) => (
              <Pressable
                key={n}
                style={[styles.chip, n === dailyNewLimit && styles.chipOn]}
                onPress={() => setDailyNewLimit(n)}
                accessibilityRole="button"
              >
                <Text style={[styles.chipText, n === dailyNewLimit && styles.chipTextOn]}>{n}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.weakBtn, styles.subLabelGap]}
            onPress={() => router.push('/scan')}
            accessibilityRole="button"
          >
            <Text style={styles.weakText}>시험 전 빠른 훑기</Text>
            <Text style={styles.weakChevron}>›</Text>
          </Pressable>

          <Pressable
            style={styles.weakBtn}
            onPress={() => router.push('/weakness')}
            accessibilityRole="button"
          >
            <Text style={styles.weakText}>약점만 다시 보기</Text>
            <Text style={styles.weakChevron}>›</Text>
          </Pressable>
        </Section>
      </ScrollView>

      {/* 하단 고정 CTA — 칩으로 고른 양만큼 학습 시작 */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.startCta, !canStart && styles.startCtaDisabled]}
          onPress={() => router.push('/study')}
          disabled={!canStart}
          accessibilityRole="button"
        >
          <Text style={styles.startCtaText}>오늘 복습 시작</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function HeroCount({ value, label }: { value: number; label: string }): React.ReactNode {
  return (
    <View style={styles.heroCountBox}>
      <Text style={styles.heroValue}>{value}</Text>
      <Text style={styles.heroCountLabel}>{label}</Text>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactNode {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f5f7' },
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  content: { padding: 20, gap: 16 },
  h1: { fontSize: 30, fontWeight: '800', color: '#1a1a1a' },
  levelsHint: { fontSize: 13, color: '#0366d6', fontWeight: '600', marginTop: -8 },
  heroCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    minHeight: 150,
    justifyContent: 'center',
  },
  heroSub: { fontSize: 13, color: '#888', textAlign: 'center' },
  heroLabel: { fontSize: 14, color: '#888', fontWeight: '600' },
  heroCounts: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroPlus: { fontSize: 22, color: '#ccc', fontWeight: '700' },
  heroCountBox: { alignItems: 'center', minWidth: 72 },
  heroValue: { fontSize: 40, fontWeight: '800', color: '#0366d6' },
  heroCountLabel: { fontSize: 13, color: '#888' },
  section: { backgroundColor: 'white', borderRadius: 16, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  sectionBody: { marginTop: 12, gap: 8 },
  subLabel: { fontSize: 13, color: '#888', fontWeight: '600' },
  subLabelGap: { marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d0d0d5',
    backgroundColor: '#fafafa',
    minWidth: 48,
    alignItems: 'center',
  },
  chipOn: { backgroundColor: '#0366d6', borderColor: '#0366d6' },
  chipText: { fontSize: 15, fontWeight: '700', color: '#555' },
  chipTextOn: { color: 'white' },
  weakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eef2f6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  weakText: { fontSize: 15, fontWeight: '700', color: '#0366d6' },
  weakChevron: { fontSize: 22, color: '#0366d6' },
  footer: {
    padding: 16,
    paddingBottom: 12,
    backgroundColor: '#f5f5f7',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e5',
  },
  startCta: { backgroundColor: '#0366d6', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  startCtaDisabled: { backgroundColor: '#c2c2c8' },
  startCtaText: { color: 'white', fontSize: 16, fontWeight: '700' },
});

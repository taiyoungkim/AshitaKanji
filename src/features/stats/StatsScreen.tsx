// Design Ref: §11 통계 화면 — streak / 레벨 진행도 / 누적.
// Plan SC: 진행도/회독/streak. 데이터는 daily_stats lazy rollup (로컬 전용).

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { buildStatsService } from './buildStatsService';
import type { LevelProgress, OverallStats } from './StatsRollupService';

interface StatsView {
  streak: number;
  overall: OverallStats;
  levels: LevelProgress[];
}

export default function StatsScreen(): React.ReactNode {
  const [data, setData] = useState<StatsView | null>(null);
  const [loading, setLoading] = useState(true);

  // 화면 진입마다 lazy rollup 후 재조회 (학습 직후 최신 반영).
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      (async () => {
        const svc = await buildStatsService();
        await svc.rollup();
        const [streak, overall, levels] = await Promise.all([
          svc.getStreak(Date.now()),
          svc.getOverall(),
          svc.getLevelProgress(),
        ]);
        if (alive) {
          setData({ streak, overall, levels });
          setLoading(false);
        }
      })().catch(() => {
        if (alive) setLoading(false);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  if (loading || !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0366d6" />
        <Text style={styles.dim}>통계 계산 중…</Text>
      </View>
    );
  }

  const { streak, overall, levels } = data;
  const accuracyPct =
    overall.accuracy == null ? '—' : `${Math.round(overall.accuracy * 100)}%`;
  const minutes = Math.round(overall.totalTimeSec / 60);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>통계</Text>

      <View style={styles.streakCard}>
        <Text style={styles.streakNum}>🔥 {streak}</Text>
        <Text style={styles.streakLabel}>연속 학습일</Text>
      </View>

      <View style={styles.kpiRow}>
        <Kpi label="학습일" value={`${overall.studyDays}일`} />
        <Kpi label="새 단어" value={`${overall.totalNew}`} />
        <Kpi label="복습" value={`${overall.totalReview}`} />
      </View>
      <View style={styles.kpiRow}>
        <Kpi label="정답률" value={accuracyPct} />
        <Kpi label="다시 본 것" value={`${overall.totalAgain}`} />
        <Kpi label="학습 시간" value={`${minutes}분`} />
      </View>

      <Text style={styles.sectionTitle}>레벨별 진행도</Text>
      {levels.map((lv) => {
        const pct = lv.total > 0 ? Math.round((lv.mature / lv.total) * 100) : 0;
        return (
          <View key={lv.level} style={styles.levelRow}>
            <Text style={styles.levelTag}>{lv.level}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.levelNum}>
              {lv.mature}/{lv.total}
            </Text>
          </View>
        );
      })}

      <Text style={styles.footer}>외운 단어 = 21일 이상 기억에 남은 카드.</Text>
    </ScrollView>
  );
}

function Kpi({ label, value }: { label: string; value: string }): React.ReactNode {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  content: { padding: 20, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  dim: { fontSize: 14, color: '#888' },
  h1: { fontSize: 28, fontWeight: '800' },
  streakCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 4,
  },
  streakNum: { fontSize: 40, fontWeight: '800', color: '#e76f51' },
  streakLabel: { fontSize: 14, color: '#888' },
  kpiRow: { flexDirection: 'row', gap: 12 },
  kpi: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  kpiValue: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  kpiLabel: { fontSize: 12, color: '#888' },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginTop: 8 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  levelTag: { width: 32, fontSize: 15, fontWeight: '700', color: '#0366d6' },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e6e6ea',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 5, backgroundColor: '#2a9d8f' },
  levelNum: { width: 64, fontSize: 13, color: '#666', textAlign: 'right' },
  footer: { fontSize: 12, color: '#aaa', textAlign: 'center', marginTop: 8 },
});

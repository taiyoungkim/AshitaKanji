// Design Ref: ONIGIRI SHOP redesign — 통계 화면. 무채색·타이포 중심.
// Plan SC: 진행도/회독/streak. 데이터는 daily_stats lazy rollup (로컬 전용).

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontFamily, fontWeight, spacing, typography } from '~/design/tokens';
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
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
          <Text style={styles.dim}>통계 계산 중…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { streak, overall, levels } = data;
  const accuracyPct =
    overall.accuracy == null ? '—' : `${Math.round(overall.accuracy * 100)}%`;
  const minutes = Math.round(overall.totalTimeSec / 60);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>STATS</Text>

        <View style={styles.streakBlock}>
          <Text style={[styles.streakNum, streak === 0 && styles.zero]}>{streak}</Text>
          <Text style={styles.streakLabel}>연속 학습일</Text>
        </View>

        <View style={styles.kpiGrid}>
          <Kpi label="학습일" value={`${overall.studyDays}`} />
          <Kpi label="새 단어" value={`${overall.totalNew}`} />
          <Kpi label="복습" value={`${overall.totalReview}`} />
          <Kpi label="정답률" value={accuracyPct} />
          <Kpi label="다시 본 것" value={`${overall.totalAgain}`} />
          <Kpi label="학습 시간" value={`${minutes}분`} />
        </View>

        <Text style={styles.sectionTitle}>레벨별 진행도</Text>
        {levels.map((lv) => {
          const studiedPct = lv.total > 0 ? Math.round((lv.studied / lv.total) * 100) : 0;
          const maturePct = lv.total > 0 ? Math.round((lv.mature / lv.total) * 100) : 0;
          return (
            <View key={lv.level} style={styles.levelRow}>
              <Text style={styles.levelTag}>{lv.level}</Text>
              <View style={styles.barTrack}>
                {/* 학습(연한) 위에 외움(진한) 겹쳐 표시 — 무채색 */}
                <View style={[styles.barFillStudied, { width: `${studiedPct}%` }]} />
                <View style={[styles.barFill, { width: `${maturePct}%` }]} />
              </View>
              <Text style={styles.levelNum}>
                {lv.mature} · {lv.studied} / {lv.total}
              </Text>
            </View>
          );
        })}

        <Text style={styles.footer}>
          학습 = 한 번이라도 본 단어 · 외움 = 21일 이상 기억에 남은 카드.
        </Text>
      </ScrollView>
    </SafeAreaView>
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
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dim: {
    ...typography.small,
    color: colors.textSecondary,
  },
  h1: {
    ...typography.h2,
    color: colors.text,
  },
  streakBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 14,
    marginTop: spacing.sm,
  },
  streakNum: {
    fontSize: typography.display.fontSize,
    lineHeight: typography.display.fontSize,
    fontWeight: fontWeight.medium,
    letterSpacing: -2,
    color: colors.text,
  },
  zero: {
    color: colors.textTertiary,
  },
  streakLabel: {
    ...typography.tiny,
    color: colors.textSecondary,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.lg,
    marginTop: spacing.sm,
  },
  kpi: {
    width: '33.33%',
    gap: 4,
  },
  kpiValue: {
    ...typography.h2,
    fontFamily: fontFamily.mono,
    color: colors.text,
  },
  kpiLabel: {
    ...typography.tiny,
    color: colors.textSecondary,
  },
  sectionTitle: {
    ...typography.tiny,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  levelTag: {
    width: 32,
    ...typography.small,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 0,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  barFillStudied: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.borderStrong,
  },
  barFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.text,
  },
  levelNum: {
    width: 92,
    ...typography.tiny,
    fontFamily: fontFamily.mono,
    color: colors.textSecondary,
    textAlign: 'right',
    letterSpacing: 0,
    textTransform: 'none',
  },
  footer: {
    ...typography.small,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});

// Design Ref: ONIGIRI SHOP redesign — Shop Home.
// Existing due/new count logic stays read-only; onigiri progress is derived from completed sessions.

import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDatabase } from '~/db/open';
import { SqliteCardRepo } from '~/db/repos/sqlite/SqliteCardRepo';
import { SqliteUserCardRepo } from '~/db/repos/sqlite/SqliteUserCardRepo';
import {
  buttons,
  colors,
  fontWeight,
  spacing,
  typography,
} from '~/design/tokens';
import { buildOnigiriProgressService } from '~/features/onigiri/buildOnigiriProgressService';
import { catImages } from '~/features/onigiri/catAssets';
import { IngredientSegments } from '~/features/onigiri/components';
import {
  computeOnigiriProgress,
  type OnigiriProgressSnapshot,
} from '~/features/onigiri/progress';
import { useSettingsStore } from '~/stores/SettingsStore';
import type { JlptLevel } from '~/types/Card';

interface TodayCounts {
  due: number;
  newAvail: number;
}

interface HomeData {
  counts: TodayCounts;
  progress: OnigiriProgressSnapshot;
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

async function loadHomeData(
  levels: JlptLevel[],
  dailyNewLimit: number,
): Promise<HomeData> {
  const [countsResult, progressResult] = await Promise.allSettled([
    loadTodayCounts(levels, dailyNewLimit),
    buildOnigiriProgressService().then((svc) => svc.getSnapshot()),
  ]);

  return {
    counts:
      countsResult.status === 'fulfilled'
        ? countsResult.value
        : { due: 0, newAvail: 0 },
    progress:
      progressResult.status === 'fulfilled'
        ? progressResult.value
        : computeOnigiriProgress([]),
  };
}

export default function HomeScreen(): React.ReactNode {
  const router = useRouter();
  const selectedLevels = useSettingsStore((s) => s.selectedLevels);
  const dailyNewLimit = useSettingsStore((s) => s.dailyNewLimit);
  const hydrated = useSettingsStore((s) => s._hydrated);
  const [data, setData] = useState<HomeData | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!hydrated) return;
      let alive = true;
      setData(null);
      void loadHomeData(selectedLevels, dailyNewLimit).then((next) => {
        if (alive) setData(next);
      });
      return () => {
        alive = false;
      };
    }, [hydrated, selectedLevels, dailyNewLimit]),
  );

  const newPlanned = data ? Math.min(data.counts.newAvail, dailyNewLimit) : 0;
  const reviewCount = data?.counts.due ?? 0;
  const todayTotal = newPlanned + reviewCount;
  const allClear = !!data && todayTotal === 0;
  const canStart = todayTotal > 0;

  const progress = data?.progress ?? computeOnigiriProgress([]);
  const currentOnigiri = progress.current;
  const firstOnigiriEmpty =
    progress.totalIngredientsEarned === 0 && currentOnigiri.ingredientCount === 0;
  const onigiriName = firstOnigiriEmpty ? '첫 오니기리' : currentOnigiri.item.name;
  const catLine = allClear
    ? '오늘 몫은 끝났어.'
    : firstOnigiriEmpty
      ? '왔네. 처음 보는 얼굴이네.'
      : '왔네.';
  const startLabel = allClear ? '복습 더 하기' : 'Start Study';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <Text style={styles.display}>TODAY</Text>
          <Text style={styles.level}>{selectedLevels.join(' · ')}</Text>
        </View>

        {!data ? (
          <LoadingState />
        ) : (
          <>
            <View style={styles.stats}>
              <ShopStat value={newPlanned} label={'New\nwords'} zero={newPlanned === 0} />
              <ShopStat value={reviewCount} label="Reviews" zero={reviewCount === 0} />
            </View>

            <View style={styles.onigiriBlock}>
              <Text style={[styles.onigiriName, firstOnigiriEmpty && styles.tertiary]}>
                {onigiriName}
              </Text>
              <IngredientSegments
                count={currentOnigiri.ingredientCount}
                label={`${currentOnigiri.ingredientCount} / 4 INGREDIENTS`}
                style={styles.segments}
              />
            </View>

            <View style={styles.catline}>
              <Image source={catImages.calm} resizeMode="contain" style={styles.catImage} />
              <View style={styles.catCopy}>
                <Text style={styles.catText}>{catLine}</Text>
                <Text style={styles.catWho}>— 사장</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={styles.readingLink}
          onPress={() => router.push('/reading' as Href)}
          accessibilityRole="button"
        >
          <Text style={styles.readingLinkText}>회독 모드 · 빈도순 50단어 반복</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.startButton,
            allClear && styles.secondaryButton,
            !data && styles.disabledButton,
            pressed && data && styles.pressed,
          ]}
          onPress={() => {
            if (!data) return;
            if (canStart) router.push('/study');
            else router.push('/weakness');
          }}
          disabled={!data}
          accessibilityRole="button"
        >
          <Text style={[styles.startText, allClear && styles.secondaryText]}>
            {startLabel}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ShopStat({
  value,
  label,
  zero,
}: {
  value: number;
  label: string;
  zero: boolean;
}): React.ReactNode {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statNum, zero && styles.zero]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function LoadingState(): React.ReactNode {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.text} />
      <View style={styles.skeletonStats}>
        <Skeleton width={78} height={52} />
        <Skeleton width={60} height={12} />
      </View>
      <View style={styles.skeletonStats}>
        <Skeleton width={78} height={52} />
        <Skeleton width={54} height={12} />
      </View>
      <View style={styles.skeletonBlock}>
        <Skeleton width={170} height={26} />
        <Skeleton width={140} height={12} />
      </View>
    </View>
  );
}

function Skeleton({ width, height }: { width: number; height: number }): React.ReactNode {
  return <View style={[styles.skeleton, { width, height }]} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.bg,
  },
  readingLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  readingLinkText: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  head: {
    marginTop: spacing.xs,
  },
  display: {
    ...typography.display,
    color: colors.text,
  },
  level: {
    ...typography.tiny,
    color: colors.textSecondary,
    marginTop: 6,
  },
  stats: {
    marginTop: spacing.xxl,
    gap: spacing.lg,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 14,
  },
  statNum: {
    minWidth: 84,
    fontSize: typography.display.fontSize,
    lineHeight: typography.display.fontSize,
    fontWeight: fontWeight.medium,
    letterSpacing: -2,
    color: colors.text,
  },
  zero: {
    color: colors.textTertiary,
  },
  statLabel: {
    ...typography.tiny,
    color: colors.textSecondary,
  },
  onigiriBlock: {
    marginTop: 44,
  },
  onigiriName: {
    ...typography.h2,
    color: colors.text,
  },
  tertiary: {
    color: colors.textTertiary,
  },
  segments: {
    marginTop: 12,
  },
  catline: {
    marginTop: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  catImage: {
    width: 74,
    height: 114,
  },
  catCopy: {
    flex: 1,
  },
  catText: {
    ...typography.body,
    color: colors.text,
  },
  catWho: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 4,
  },
  startButton: {
    width: '100%',
    borderRadius: buttons.primary.borderRadius,
    paddingVertical: buttons.primary.paddingVertical,
    paddingHorizontal: buttons.primary.paddingHorizontal,
    alignItems: 'center',
    backgroundColor: buttons.primary.backgroundColor,
    borderWidth: 1,
    borderColor: buttons.primary.borderColor,
  },
  secondaryButton: {
    backgroundColor: buttons.secondary.backgroundColor,
    borderColor: buttons.secondary.borderColor,
  },
  disabledButton: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.surfaceMuted,
  },
  pressed: {
    opacity: 0.86,
  },
  startText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: fontWeight.medium,
    color: buttons.primary.color,
  },
  secondaryText: {
    color: buttons.secondary.color,
  },
  loading: {
    marginTop: spacing.xxl,
    gap: spacing.lg,
  },
  skeletonStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  skeletonBlock: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  skeleton: {
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
  },
});

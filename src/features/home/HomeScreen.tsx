// Design Ref: Onikan handoff 화면 1 — 홈 (`10a`).
//
// 회독은 두 번째 버튼이 아니라 상단 세그먼트의 '모드'다. 그래야 하단 오렌지 CTA 가
// 계속 하나로 유지된다. 선택한 모드가 히어로 카드 내용과 CTA 문구에 함께 반영된다.

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  border,
  font,
  layout,
  radius,
  spacing,
  typography,
  type ThemeColors,
} from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import { IconChevron } from '~/design/icons';
import { Button } from '~/components/ui/Button';
import { SegmentedControl } from '~/components/ui/SegmentedControl';
import { Card, Overline, ProgressSegments, PlateTile } from '~/components/ui/Surface';
import { buildOnigiriProgressService } from '~/features/onigiri/buildOnigiriProgressService';
import { INGREDIENTS_PER_ONIGIRI } from '~/features/onigiri/catalog';
import { mascotImage, recipeImage } from '~/features/onigiri/recipeAssets';
import {
  computeOnigiriProgress,
  type OnigiriProgressSnapshot,
} from '~/features/onigiri/progress';
import { loadLevelChapterStats } from '~/features/reading/buildReadingEngine';
import {
  loadTodayCounts,
  resolveStudyRoute,
  type TodayCounts,
} from '~/features/study/resolveStudyEntry';
import { useSettingsStore } from '~/stores/SettingsStore';
import type { JlptLevel } from '~/types/Card';
import { chapterStatus, isChapterComplete, type ChapterStat } from '~/types/Reading';
import { estimateStudyMinutes, formatKoreanDate, ingredientCaption } from './homePresentation';

type HomeMode = 'today' | 'reading';

interface ReadingTarget {
  level: JlptLevel;
  chapter: number;
  total: number;
  known: number;
}

interface HomeData {
  counts: TodayCounts;
  progress: OnigiriProgressSnapshot;
  reading: ReadingTarget | null;
}

/** 회독은 순차 해금이라 '아직 안 끝난 첫 챕터'가 곧 다음에 할 묶음이다. */
function pickCurrentChapter(level: JlptLevel, stats: ChapterStat[]): ReadingTarget | null {
  const sorted = [...stats].sort((a, b) => a.chapter - b.chapter);
  const target =
    sorted.find((s) => !isChapterComplete(s) && chapterStatus(sorted, s.chapter) === 'inProgress') ??
    sorted.find((s) => !isChapterComplete(s)) ??
    sorted[sorted.length - 1];
  if (!target) return null;
  return { level, chapter: target.chapter, total: target.total, known: target.known };
}

async function loadHomeData(levels: JlptLevel[], dailyNewLimit: number): Promise<HomeData> {
  const readingLevel = levels[0] ?? 'N5';
  const [countsResult, progressResult, readingResult] = await Promise.allSettled([
    loadTodayCounts(levels, dailyNewLimit),
    buildOnigiriProgressService().then((svc) => svc.getSnapshot()),
    loadLevelChapterStats(readingLevel),
  ]);

  return {
    counts: countsResult.status === 'fulfilled' ? countsResult.value : { due: 0, newAvail: 0 },
    progress:
      progressResult.status === 'fulfilled' ? progressResult.value : computeOnigiriProgress([]),
    reading:
      readingResult.status === 'fulfilled'
        ? pickCurrentChapter(readingLevel, readingResult.value)
        : null,
  };
}

export default function HomeScreen(): React.ReactNode {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const selectedLevels = useSettingsStore((s) => s.selectedLevels);
  const dailyNewLimit = useSettingsStore((s) => s.dailyNewLimit);
  const hydrated = useSettingsStore((s) => s._hydrated);
  const [data, setData] = useState<HomeData | null>(null);
  const [mode, setMode] = useState<HomeMode>('today');

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

  const today = useMemo(() => formatKoreanDate(new Date()), []);

  const newPlanned = data ? Math.min(data.counts.newAvail, dailyNewLimit) : 0;
  const reviewCount = data?.counts.due ?? 0;
  const todayTotal = newPlanned + reviewCount;
  const allClear = data != null && todayTotal === 0;

  const progress = data?.progress ?? computeOnigiriProgress([]);
  const current = progress.current;
  const allCollected = progress.completedCount === progress.totalCount;
  const firstOnigiriEmpty = progress.totalIngredientsEarned === 0 && current.ingredientCount === 0;

  const reading = data?.reading ?? null;
  const readingRemaining = reading ? Math.max(reading.total - reading.known, 0) : 0;

  const isReading = mode === 'reading';

  // 카드 하나에 히어로 숫자는 하나다. 오늘 몫에 새 단어가 있으면 그게 히어로가 되고,
  // 복습만 남았으면 복습 수가 히어로를 맡는다. 나머지는 아래 메타 한 줄로 내려간다.
  const heroIsReview = !isReading && newPlanned === 0 && reviewCount > 0;
  const heroValue = isReading ? (reading?.total ?? 0) : heroIsReview ? reviewCount : newPlanned;
  const heroUnit = isReading ? '빈도순 단어' : heroIsReview ? '복습' : '새 단어';

  // 값이 0인 항목은 문장에서 뺀다 — "복습 0개"를 쓰지 않는다.
  const heroMeta = isReading
    ? [
        reading?.level,
        reading ? `${(reading.chapter - 1) * 50 + 1}–${reading.chapter * 50}번` : null,
        reading ? `약 ${estimateStudyMinutes(readingRemaining, 0)}분` : null,
      ]
    : [
        selectedLevels.join('·'),
        !heroIsReview && reviewCount > 0 ? `복습 ${reviewCount}개` : null,
        todayTotal > 0 ? `약 ${estimateStudyMinutes(newPlanned, reviewCount)}분` : null,
        allClear ? '오늘 몫 완료' : null,
      ];
  const metaLine = heroMeta.filter(Boolean).join(' · ');

  const mascotLine = allCollected
    ? '전부 모았네. 대단해.'
    : isReading
      ? '가볍게 훑고 가.'
      : allClear
        ? '오늘 몫은 끝났어.'
        : firstOnigiriEmpty
          ? '왔네. 처음 보는 얼굴이네.'
          : '왔네. 오늘 것만 하고 가.';

  const ctaLabel = isReading ? '회독 시작' : allClear ? '복습 더 하기' : '오늘 학습 시작';

  const onStart = () => {
    if (!data) return;
    if (isReading) {
      if (reading) router.push(`/reading-study?level=${reading.level}&chapter=${reading.chapter}` as Href);
      else router.push('/reading' as Href);
      return;
    }
    router.push(resolveStudyRoute({ due: reviewCount, newAvail: newPlanned }));
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Overline>{today}</Overline>

        <SegmentedControl
          style={styles.segment}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'today', label: '오늘 학습' },
            { value: 'reading', label: '회독' },
          ]}
        />

        {!data ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.body} />
          </View>
        ) : (
          <View style={styles.cardGroup}>
            <Card variant="elevated" style={styles.heroCard}>
              <Overline>{isReading ? '회독' : '오늘의 학습'}</Overline>
              <View style={styles.heroRow}>
                <Text style={styles.heroValue}>{heroValue}</Text>
                <Text style={styles.heroUnit}>{heroUnit}</Text>
              </View>
              {metaLine.length > 0 && <Text style={styles.heroMeta}>{metaLine}</Text>}
            </Card>

            {isReading ? (
              <View style={styles.readingBlock}>
                <Text style={styles.readingNote}>
                  기록에 남지 않고 가볍게 훑는 모드예요. 재료는 오늘 학습에서만 받아요.
                </Text>
                <View style={styles.chipRow}>
                  <Pressable
                    style={styles.chip}
                    onPress={() => router.push('/reading' as Href)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.chipLabel}>범위 고르기</Text>
                  </Pressable>
                  <Pressable
                    style={styles.chip}
                    onPress={() => router.push('/weakness' as Href)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.chipLabel}>틀린 단어만</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              // 히어로와 같은 흰 카드지만 그림자를 뺐다 — 층은 그림자 유무로만 나눈다.
              <Pressable
                style={({ pressed }) => [styles.progressCard, pressed && styles.progressPressed]}
                onPress={() =>
                  router.push({ pathname: '/onigiri/[id]', params: { id: current.item.id } })
                }
                accessibilityRole="button"
                accessibilityLabel={`${current.item.name} 상세 보기, 재료 ${current.ingredientCount}개 모음`}
              >
                <PlateTile size={48} image={recipeImage(current.item.imageKey)} imageSize={40} />
                <View style={styles.progressBody}>
                  <View style={styles.progressHead}>
                    <Text style={styles.progressName} numberOfLines={1}>
                      {current.item.name}
                    </Text>
                    <Text style={styles.progressCount}>
                      {current.ingredientCount} / {INGREDIENTS_PER_ONIGIRI}
                    </Text>
                  </View>
                  <ProgressSegments
                    total={INGREDIENTS_PER_ONIGIRI}
                    filled={current.ingredientCount}
                    height={5}
                    gap={6}
                  />
                  <Text style={styles.progressCaption}>
                    {ingredientCaption(current.ingredientCount)}
                  </Text>
                </View>
                <IconChevron size={20} color={colors.body} />
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.spacer} />

        <View style={styles.mascotRow}>
          <PlateTile size={44} image={mascotImage} imageSize={38} />
          <Text style={styles.mascotLine}>{mascotLine}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label={ctaLabel} onPress={onStart} disabled={!data} />
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.softer },
    scroll: { flex: 1 },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: layout.gutter,
      paddingTop: spacing.xxl,
    },

    segment: { marginTop: spacing.lg },

    loading: { marginTop: spacing.huge, alignItems: 'center' },

    // 두 카드는 12px 로 붙여 한 덩어리로 읽히게 한다.
    cardGroup: { marginTop: spacing.xl, gap: layout.gapTight },
    heroCard: { paddingVertical: 24, paddingHorizontal: layout.gutter },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: layout.gapTight,
      marginTop: layout.gapTight,
    },
    heroValue: { ...typography.hero, color: c.ink },
    heroUnit: { ...typography.body, color: c.body },
    heroMeta: { ...typography.body, color: c.body, marginTop: 10, fontVariant: ['tabular-nums'] },

    progressCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: c.canvas,
      borderRadius: radius.card,
      paddingVertical: spacing.lg,
      paddingLeft: 18,
      paddingRight: spacing.lg,
    },
    progressPressed: { backgroundColor: c.soft },
    progressBody: { flex: 1, gap: 10 },
    progressHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    progressName: { ...typography.cardTitle, color: c.ink, flexShrink: 1 },
    progressCount: { ...typography.caption, color: c.body },
    progressCaption: { ...typography.body, color: c.body },

    readingBlock: { gap: spacing.lg, paddingHorizontal: spacing.xs },
    readingNote: { ...typography.body, color: c.body },
    chipRow: { flexDirection: 'row', gap: spacing.sm },
    chip: {
      borderRadius: radius.pill,
      borderWidth: border.chip,
      borderColor: c.pressed,
      paddingVertical: 9,
      paddingHorizontal: 14,
    },
    chipLabel: { fontFamily: font.semibold, fontSize: 14, lineHeight: 18, color: c.ink },

    spacer: { flex: 1, minHeight: spacing.xxl },

    mascotRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: layout.gapTight,
      paddingBottom: 18,
    },
    mascotLine: { ...typography.body, color: c.body, flex: 1 },

    footer: {
      paddingHorizontal: layout.gutter,
      paddingBottom: layout.gutter,
      backgroundColor: c.softer,
    },
  });

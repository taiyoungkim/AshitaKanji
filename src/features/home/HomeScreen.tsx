import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HTML_FLOW_PAGE, cardShadow, font, layout, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import { getDatabase } from '~/db/open';
import { SqliteSessionRepo } from '~/db/repos/sqlite/SqliteSessionRepo';
import { buildOnigiriProgressService } from '~/features/onigiri/buildOnigiriProgressService';
import { recipeImage } from '~/features/onigiri/recipeAssets';
import { onboardingImages } from '~/features/onigiri/onboardingAssets';
import { computeOnigiriProgress, type OnigiriProgressSnapshot } from '~/features/onigiri/progress';
import { loadLevelChapterStats } from '~/features/reading/buildReadingEngine';
import { buildRecordService } from '~/features/stats/buildRecordService';
import type { RecordSnapshot } from '~/features/stats/recordTypes';
import { loadTodayCounts, resolveStudyRoute, type TodayCounts } from '~/features/study/resolveStudyEntry';
import { useSettingsStore } from '~/stores/SettingsStore';
import { JLPT_LEVELS, type JlptLevel } from '~/types/Card';
import { isChapterComplete, resolveCurrentChapter, type ChapterStat } from '~/types/Reading';
import { estimateStudyMinutes, formatKoreanDate } from './homePresentation';
import { buildHomeDayState, type HomeDayState } from './homeState';
import { StreakCard } from './components/StreakStamps';
import { isVisualCaptureEnabled, VISUAL_NOW_MS } from '~/visual/captureFixtures';
import type { OnigiriIngredientList } from '~/features/onigiri/types';
import {
  HomeAllDoneCard,
  HomeStudyCompleteHero,
  HomeStudyHero,
  MonthlyMenuCard,
  ReadingContinueSection,
  RecentOnigiriCard,
} from './components/HomeSections';

interface ReadingTarget {
  level: JlptLevel;
  chapter: number;
  total: number;
  covered: number;
}

function toReadingTarget(level: JlptLevel, stat: ChapterStat | null): ReadingTarget | null {
  return stat ? { level, chapter: stat.chapter, total: stat.total, covered: stat.covered } : null;
}

interface HomeData {
  counts: TodayCounts;
  progress: OnigiriProgressSnapshot;
  reading: ReadingTarget | null;
  readingCovered: number;
  readingTotal: number;
  record: RecordSnapshot | null;
  day: HomeDayState;
}

function isSameLocalDay(leftMs: number, rightMs: number): boolean {
  const left = new Date(leftMs);
  const right = new Date(rightMs);
  return left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
}

async function loadHomeData(
  levels: JlptLevel[],
  dailyNewLimit: number,
  readingLevel: JlptLevel,
  savedChapter: number | undefined,
  nowMs = Date.now(),
): Promise<HomeData> {
  const [countsResult, progressResult, readingResult, recordResult, sessionsResult] = await Promise.allSettled([
    loadTodayCounts(levels, dailyNewLimit, nowMs),
    buildOnigiriProgressService().then((svc) => svc.getSnapshot()),
    loadLevelChapterStats(readingLevel),
    buildRecordService().then((svc) => svc.load(nowMs)),
    getDatabase().then((db) => new SqliteSessionRepo(db).findAll()),
  ]);

  const counts = countsResult.status === 'fulfilled' ? countsResult.value : { due: 0, newAvail: 0 };
  const readingStats = readingResult.status === 'fulfilled' ? readingResult.value : [];
  const sessions = sessionsResult.status === 'fulfilled' ? sessionsResult.value : [];
  const readingCompleteToday = readingStats.some(
    (stat) => isChapterComplete(stat) && stat.lastUpdatedAt != null && isSameLocalDay(stat.lastUpdatedAt, nowMs),
  );
  const day = buildHomeDayState({
    sessions,
    nowMs,
    remainingStudyCount: counts.due + Math.min(counts.newAvail, dailyNewLimit),
    readingCompleteToday,
  });

  return {
    counts,
    progress: progressResult.status === 'fulfilled' ? progressResult.value : computeOnigiriProgress([]),
    // 회독 허브와 같은 챕터를 가리켜야 한다 — 기억한 챕터를 같은 규칙으로 푼다.
    reading: toReadingTarget(readingLevel, resolveCurrentChapter(readingStats, savedChapter)),
    readingCovered: readingStats.reduce((sum, stat) => sum + stat.covered, 0),
    readingTotal: readingStats.reduce((sum, stat) => sum + stat.total, 0),
    record: recordResult.status === 'fulfilled' ? recordResult.value : null,
    day,
  };
}

export default function HomeScreen(): React.ReactNode {
  const router = useRouter();
  const { colors, name } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const selectedLevels = useSettingsStore((s) => s.selectedLevels);
  const setLevels = useSettingsStore((s) => s.setLevels);
  const dailyNewLimit = useSettingsStore((s) => s.dailyNewLimit);
  const hydrated = useSettingsStore((s) => s._hydrated);
  // 회독 관련 표시는 학습 레벨이 아니라 회독 화면에서 고른 레벨을 따른다.
  const readingLevel = useSettingsStore((s) => s.readingLevel);
  const savedChapter = useSettingsStore((s) => s.readingChapters[s.readingLevel]);
  const { uiFixture } = useLocalSearchParams<{ uiFixture?: string }>();
  const captureMode = isVisualCaptureEnabled() && uiFixture != null;
  const nowMs = captureMode ? VISUAL_NOW_MS : Date.now();
  const [data, setData] = useState<HomeData | null>(null);
  const [levelPickerOpen, setLevelPickerOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!hydrated) return;
      let alive = true;
      void loadHomeData(selectedLevels, dailyNewLimit, readingLevel, savedChapter, nowMs).then((next) => {
        if (alive) setData(next);
      });
      return () => { alive = false; };
    }, [hydrated, selectedLevels, dailyNewLimit, readingLevel, savedChapter, nowMs]),
  );

  const today = useMemo(() => formatKoreanDate(new Date(nowMs)), [nowMs]);
  const level = selectedLevels[0] ?? 'N5';
  const progress = data?.progress ?? computeOnigiriProgress([]);
  const current = progress.current;
  // The handoff's study-before fixture intentionally shows the first recipe
  // (2/5) even though the production catalog currently uses four ingredients.
  // Keep this visual-only projection local to capture mode; production stays data-driven.
  const visualStudyBefore = isVisualCaptureEnabled() && uiFixture === '01-home-study-before';
  const visualCurrent = visualStudyBefore
    ? { ...current, item: { ...current.item, name: '참치마요', ingredients: ['RICE', 'TUNA', 'MAYO', 'NORI'] as OnigiriIngredientList }, ingredientCount: 2 }
    : current;
  const reading = data?.reading ?? null;
  const day = data?.day ?? null;
  const phase = day?.phase ?? 'studyBefore';
  const todayAgain = day?.againCount ?? 0;
  const streakDays = visualStudyBefore ? 5 : data?.record?.streakDays ?? 0;
  const newCount = data ? Math.min(data.counts.newAvail, dailyNewLimit) : 0;
  const dueCount = data?.counts.due ?? 0;
  const plannedCount = newCount + dueCount;
  const studyMinutes = estimateStudyMinutes(newCount, dueCount);
  const recentEntry =
    progress.lastReward?.item ??
    [...progress.entries].reverse().find((entry) => entry.status === 'completed')?.item ??
    current.item;
  const readingTotal = data?.readingTotal ?? 0;
  const readingCovered = data?.readingCovered ?? 0;
  const menuProgress = readingTotal > 0 ? readingCovered / readingTotal : 0;

  const startStudy = () => {
    if (!data) return;
    router.push(resolveStudyRoute({ due: dueCount, newAvail: newCount }));
  };
  const openHub = () => {
    router.push('/reading' as Href);
  };
  const openTodayReview = () => {
    if (!day?.studySessionId) return;
    router.push(`/weakness?source=today&sessionId=${day.studySessionId}` as Href);
  };
  const openTodayWords = () => {
    if (!day?.studySessionId) return;
    router.push(`/today-words?sessionId=${day.studySessionId}` as Href);
  };
  // 홈 칩은 "새로 배울 레벨" 하나를 고르는 단일 선택이다. 기존 due는 전 레벨 유지한다.
  // 고른 레벨을 앞에 붙이는 방식은 동작하지 않는다 — 스토어가 배열을 항상 N5→N1 로
  // 정규화해서, 무엇을 골라도 selectedLevels[0] 이 가장 낮은 레벨로 되돌아간다.
  // 여러 레벨을 함께 학습하려면 설정 > 학습 설정에서 고른다.
  const selectPrimaryLevel = (next: JlptLevel) => {
    setLevels([next]);
    setLevelPickerOpen(false);
  };

  return (
    <SafeAreaView style={[styles.root, name === 'light' && { backgroundColor: HTML_FLOW_PAGE }]} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.date}>{today}</Text>
            <Text style={styles.placeTitle}>오니기리 가게</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.levelChip, pressed && styles.levelChipPressed]}
            onPress={() => setLevelPickerOpen(true)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`새 단어 레벨 ${level}, 변경`}
          >
            <Text style={styles.levelLabel}>{level}</Text>
            <Text style={styles.levelChevron}>▾</Text>
          </Pressable>
        </View>

        {!data ? (
          <View style={styles.loading}><ActivityIndicator color={colors.body} /></View>
        ) : (
          <>
            {phase === 'studyBefore' ? (
              <HomeStudyHero
                recipe={visualCurrent.item}
                ingredientCount={visualCurrent.ingredientCount}
                plannedCount={plannedCount}
                minutes={studyMinutes}
                mascot={onboardingImages.home}
                disabled={plannedCount === 0}
                onPress={startStudy}
              />
            ) : (
              <HomeStudyCompleteHero
                phase={phase}
                studyCount={day?.studyCount ?? 0}
                reviewCount={todayAgain}
                mascot={onboardingImages.home}
                onReview={openTodayReview}
                onBrowse={openTodayWords}
              />
            )}

            {phase === 'allDone' ? (
              <HomeAllDoneCard
                reviewCount={todayAgain}
                studyCount={day?.studyCount ?? 0}
                image={recipeImage(visualStudyBefore ? 'onigiri-001' : recentEntry.imageKey)}
                onHub={openHub}
              />
            ) : phase !== 'studyBefore' ? (
              <ReadingContinueSection reading={reading} onHub={openHub} />
            ) : null}

            <StreakCard days={streakDays} />

            <RecentOnigiriCard
              name={visualStudyBefore ? '참치마요' : recentEntry.name}
              image={recipeImage(recentEntry.imageKey)}
              onPress={() => router.push({ pathname: '/onigiri/[id]', params: { id: recentEntry.id } })}
            />

            <MonthlyMenuCard
              month={new Date().getMonth() + 1}
              level={readingLevel}
              total={readingTotal}
              progress={menuProgress}
              onPress={() => router.push('/collection' as Href)}
            />
          </>
        )}
      </ScrollView>

      <Modal
        visible={levelPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLevelPickerOpen(false)}
      >
        <Pressable style={styles.scrim} onPress={() => setLevelPickerOpen(false)}>
          <Pressable style={[styles.levelSheet, cardShadow(colors)]} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>새 단어 레벨</Text>
            <View style={styles.levelOptions}>
              {JLPT_LEVELS.map((item) => {
                const selected = item === level;
                return (
                  <Pressable
                    key={item}
                    style={[styles.levelOption, selected && styles.levelOptionSelected]}
                    onPress={() => selectPrimaryLevel(item)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.levelOptionLabel, selected && styles.levelOptionLabelSelected]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.softer },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 16, paddingTop: spacing.lg, paddingBottom: spacing.huge, gap: spacing.lg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
    date: { ...typography.caption, color: c.body, marginBottom: spacing.xs },
    placeTitle: {
      fontFamily: font.extrabold,
      fontSize: 26,
      lineHeight: 32,
      letterSpacing: -0.5,
      color: c.ink,
    },
    levelChip: {
      minWidth: 62,
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      backgroundColor: c.canvas,
      flexDirection: 'row',
      gap: 5,
      alignItems: 'center',
      justifyContent: 'center',
      ...cardShadow(c),
    },
    levelChipPressed: { backgroundColor: c.soft },
    levelLabel: { ...typography.bodyStrong, color: c.ink },
    levelChevron: { ...typography.caption, color: c.mute },
    loading: { minHeight: 360, alignItems: 'center', justifyContent: 'center' },
    scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.34)', justifyContent: 'flex-end' },
    levelSheet: {
      borderTopLeftRadius: radius.card,
      borderTopRightRadius: radius.card,
      backgroundColor: c.canvas,
      paddingHorizontal: layout.gutter,
      paddingTop: spacing.xl,
      paddingBottom: spacing.huge,
      gap: spacing.lg,
    },
    sheetTitle: { ...typography.listTitle, color: c.ink },
    levelOptions: { flexDirection: 'row', gap: spacing.sm },
    levelOption: {
      flex: 1,
      minHeight: 48,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: c.pressed,
      alignItems: 'center',
      justifyContent: 'center',
    },
    levelOptionSelected: { backgroundColor: c.ink, borderColor: c.ink },
    levelOptionLabel: { ...typography.bodyStrong, color: c.body },
    levelOptionLabelSelected: { color: c.onInk },
  });

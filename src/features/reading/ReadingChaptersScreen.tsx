// Design Ref: review-hub.html — 회독 기록 링 게이지 + 현재 회독 선형 바 + 챕터 뱃지.

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '~/components/ui/Button';
import { Card, Overline } from '~/components/ui/Surface';
import { StatusBadge } from '~/components/ui/StatusBadge';
import { IconCheck, IconChevron } from '~/design/icons';
import { onboardingImages } from '~/features/onigiri/onboardingAssets';
import { recipeImage } from '~/features/onigiri/recipeAssets';
import { HTML_FLOW_PAGE, cardShadow, layout, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { MainTabBar } from '~/components/MainTabBar';
import { useTheme, useThemedStyles } from '~/design/theme';

import type { JlptLevel } from '~/types/Card';
import { chapterStatus, isChapterComplete, pickCurrentChapter, type ChapterStat } from '~/types/Reading';
import { countReadingPasses, loadLevelChapterStats } from './buildReadingEngine';
import { ArcGauge } from './components/ArcGauge';
import { isVisualCaptureEnabled } from '~/visual/captureFixtures';

// 필터 시트는 N1이 위 — 최종 화면 12 순서.
const LEVELS: JlptLevel[] = ['N1', 'N2', 'N3', 'N4', 'N5'];

export default function ReadingChaptersScreen(): React.ReactNode {
  const { colors, name } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const [level, setLevel] = useState<JlptLevel>('N5');
  const [stats, setStats] = useState<ChapterStat[] | null>(null);
  const [passes, setPasses] = useState(0);
  const params = useLocalSearchParams<{ completed?: string; uiFixture?: string }>();
  const [filterOpen, setFilterOpen] = useState(
    isVisualCaptureEnabled() && params.uiFixture === '12-review-hub-filter',
  );
  const justCompleted = Number(params.completed);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void loadLevelChapterStats(level).then((next) => {
        if (alive) setStats(next);
      });
      void countReadingPasses(level)
        .then((next) => {
          if (alive) setPasses(next);
        })
        .catch(() => undefined);
      return () => { alive = false; };
    }, [level]),
  );

  const summary = useMemo(() => {
    const values = stats ?? [];
    const total = values.reduce((sum, item) => sum + item.total, 0);
    const covered = values.reduce((sum, item) => sum + item.covered, 0);
    const current = pickCurrentChapter(values);
    return { total, covered, current, progress: total > 0 ? covered / total : 0 };
  }, [stats]);

  const openChapter = (chapter: number) => {
    router.push(`/reading-study?level=${level}&chapter=${chapter}` as Href);
  };

  const current = summary.current;
  const currentRemaining = current ? Math.max(0, current.total - current.covered) : 0;
  const currentPercent = current && current.total ? (current.covered / current.total) * 100 : 0;

  return (
    <SafeAreaView style={[styles.root, name === 'light' && { backgroundColor: HTML_FLOW_PAGE }]} edges={['top']}>
      <View style={styles.topNav}>
        <Pressable
          style={({ pressed }) => [styles.backPill, pressed && styles.backPillPressed]}
          onPress={() => router.back()}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="오늘로 돌아가기"
        >
          <IconChevron size={16} color={colors.ink} direction="left" />
          <Text style={styles.backLabel}>오늘</Text>
        </Pressable>
        <Text style={styles.navTitle}>회독</Text>
        <Pressable
          style={({ pressed }) => [styles.levelChip, pressed && styles.backPillPressed]}
          onPress={() => setFilterOpen(true)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`회독 레벨 ${level}, 변경`}
        >
          <Text style={styles.levelChipLabel}>{level}</Text>
          <Text style={styles.levelChevron}>▾</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card variant="elevated" style={styles.summaryCard}>
          <Image source={onboardingImages.home} style={styles.summaryMascot} resizeMode="contain" />
          <Text style={styles.summaryLabel}>회독 기록</Text>
          <View style={styles.summaryTop}>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryValue}>
                {passes}
                <Text style={styles.summaryUnit}>회</Text>
              </Text>
              <Text style={styles.summaryCaption}>지금까지 회독했어요.</Text>
            </View>
            <ArcGauge progress={summary.progress} label={level} />
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryRowLabel}>익힌 단어</Text>
            <Text style={styles.summaryRowValue}>{summary.covered} / {summary.total}</Text>
          </View>
        </Card>

        {current && !isChapterComplete(current) ? (
          <View style={styles.section}>
            {Number.isInteger(justCompleted) && justCompleted > 0 ? (
              <View style={styles.banner}>
                <View style={styles.bannerCheck}>
                  <IconCheck size={14} color={colors.ink} />
                </View>
                <View style={styles.bannerCopy}>
                  <Text style={styles.bannerTitle}>챕터 {justCompleted} 완료!</Text>
                  <Text style={styles.bannerBody}>50개 단어를 모두 익혔어요. 다음 챕터가 열렸어요.</Text>
                </View>
              </View>
            ) : null}
            <Text style={styles.sectionOverline}>현재 회독</Text>
            <Card variant="elevated" style={styles.currentCard}>
              <Text style={styles.currentTitle}>
                챕터 {current.chapter}{current.covered === 0 ? ' · 새로 열림' : ''}
              </Text>
              <Text style={styles.currentMeta}>{current.covered} / {current.total} 단어</Text>
              <View style={styles.linearTrack}>
                <View style={[styles.linearFill, { width: `${currentPercent}%` }]} />
              </View>
              <Text style={styles.currentRemaining}>
                {currentRemaining > 0 ? `${currentRemaining}개 남았어요.` : '모두 외웠어요.'}
              </Text>
              <Button
                label={current.covered === 0 ? `챕터 ${current.chapter} 시작하기` : '이어서 회독하기'}
                variant="brand"
                onPress={() => openChapter(current.chapter)}
              />
            </Card>
          </View>
        ) : current && isChapterComplete(current) ? (
          <View style={styles.section}>
            <Text style={styles.sectionOverline}>회독 완료</Text>
            <Card style={styles.levelDoneCard}>
              {recipeImage('onigiri-001') ? (
                <Image source={recipeImage('onigiri-001')} style={styles.levelDoneArt} resizeMode="contain" />
              ) : null}
              <Overline>{level} 회독 완료</Overline>
              <Text style={styles.levelDoneTitle}>모든 챕터를 마쳤어요.</Text>
              <Text style={styles.levelDoneSub}>{summary.covered} / {summary.total} 단어 · 전체 진척도 100%</Text>
            </Card>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionOverline}>회독 챕터</Text>
          <Text style={styles.sectionSubtitle}>50개씩 모두 익힐 때까지 반복해요.</Text>

          <View style={styles.list}>
            {stats === null ? (
              <Text style={styles.empty}>불러오는 중…</Text>
            ) : stats.length === 0 ? (
              <Text style={styles.empty}>이 레벨은 회독 데이터가 없어요.</Text>
            ) : stats.map((stat) => {
              const status = chapterStatus(stats, stat.chapter);
              const locked = status === 'locked';
              const completed = status === 'completed';
              const unlocked = status === 'inProgress' && stat.covered === 0;
              return (
                <View key={stat.chapter}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.chapterRow,
                      locked && styles.chapterRowLocked,
                      pressed && !locked && styles.rowPressed,
                    ]}
                    disabled={locked}
                    onPress={() => openChapter(stat.chapter)}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: locked }}
                  >
                    <View style={[styles.numberBadge, completed && styles.numberBadgeDone, locked && styles.numberBadgeLocked]}>
                      {completed ? (
                        <IconCheck size={16} color={colors.success} />
                      ) : (
                        <Text style={[styles.number, locked && styles.lockedText]}>
                          {String(stat.chapter).padStart(2, '0')}
                        </Text>
                      )}
                    </View>
                    <View style={styles.chapterCopy}>
                      <Text style={[styles.chapterTitle, locked && styles.lockedText]}>
                        챕터 {stat.chapter}
                      </Text>
                      <Text style={[styles.chapterMeta, locked && styles.lockedText]}>
                        {stat.covered} / {stat.total} 단어
                      </Text>
                    </View>
                    {completed ? (
                      <StatusBadge kind="complete" label="완료" />
                    ) : locked ? (
                      <Text style={styles.lockedLabel}>잠김</Text>
                    ) : unlocked ? (
                      <StatusBadge kind="new" label="새로 열림" />
                    ) : (
                      <StatusBadge kind="inProgress" label="진행 중" />
                    )}
                  </Pressable>
                  {unlocked ? (
                    <Pressable onPress={() => openChapter(stat.chapter)} hitSlop={8}>
                      <Text style={styles.startLink}>시작하기 ›</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setFilterOpen(false)}>
          <Pressable style={[styles.sheet, cardShadow(colors)]} onPress={() => undefined}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>레벨</Text>
            {LEVELS.map((item, index) => {
              const selected = item === level;
              return (
                <Pressable
                  key={item}
                  style={[styles.levelRow, index > 0 && styles.levelRowDivided]}
                  onPress={() => { setLevel(item); setStats(null); setFilterOpen(false); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <Text style={styles.levelRowLabel}>{item}</Text>
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
      <MainTabBar active="home" />
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.softer },
    topNav: {
      minHeight: 64,
      paddingHorizontal: layout.gutter,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backPill: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: c.canvas,
      paddingHorizontal: spacing.md,
    },
    backPillPressed: { backgroundColor: c.soft },
    backLabel: { ...typography.captionStrong, color: c.ink },
    navTitle: { ...typography.cardTitle, color: c.ink },
    levelChip: {
      minWidth: 62,
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: c.canvas,
      paddingHorizontal: spacing.md,
    },
    levelChipLabel: { ...typography.bodyStrong, color: c.ink },
    levelChevron: { ...typography.caption, color: c.mute },

    content: {
      paddingHorizontal: layout.gutter,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      gap: spacing.xl,
    },

    summaryCard: { padding: spacing.lg, gap: spacing.md, position: 'relative' },
    summaryMascot: { position: 'absolute', top: 16, right: 16, width: 56, height: 56 },
    summaryTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    summaryCopy: { flex: 1, gap: spacing.xs },
    summaryLabel: { ...typography.captionStrong, color: c.body, letterSpacing: 1 },
    summaryValue: { ...typography.screenTitle, color: c.ink },
    summaryUnit: { ...typography.cardTitle, color: c.ink },
    summaryCaption: { ...typography.caption, color: c.body },
    summaryDivider: { height: StyleSheet.hairlineWidth, backgroundColor: c.pressed },
    summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    summaryRowLabel: { ...typography.caption, color: c.body },
    summaryRowValue: { ...typography.captionStrong, color: c.ink },

    section: { gap: spacing.md },
    sectionOverline: {
      ...typography.captionStrong,
      color: c.mute,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    sectionSubtitle: { ...typography.caption, color: c.body, marginTop: -spacing.xs },
    banner: {
      backgroundColor: c.primarySoft,
      borderRadius: 18,
      padding: spacing.md,
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'flex-start',
    },
    bannerCheck: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: c.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bannerCopy: { flex: 1, gap: 3 },
    bannerTitle: { ...typography.bodyStrong, color: c.ink },
    bannerBody: { ...typography.caption, color: c.body, lineHeight: 20 },
    levelDoneCard: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
    levelDoneArt: { width: 96, height: 96 },
    levelDoneTitle: { ...typography.listTitle, color: c.ink, textAlign: 'center' },
    levelDoneSub: { ...typography.caption, color: c.body },

    currentCard: { gap: spacing.sm },
    currentTitle: { ...typography.listTitle, color: c.ink },
    currentMeta: { ...typography.captionStrong, color: c.body },
    linearTrack: {
      height: 10,
      borderRadius: radius.pill,
      backgroundColor: c.pressed,
      overflow: 'hidden',
      marginTop: spacing.xs,
    },
    linearFill: { height: '100%', borderRadius: radius.pill, backgroundColor: c.ink },
    currentRemaining: { ...typography.bodyStrong, color: c.primary, marginTop: spacing.sm, marginBottom: spacing.sm },

    list: { gap: spacing.sm },
    chapterRow: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: c.canvas,
      borderRadius: 18,
      padding: spacing.md,
    },
    chapterRowLocked: { backgroundColor: c.soft },
    rowPressed: { backgroundColor: c.soft },
    numberBadge: {
      width: 34,
      height: 34,
      borderRadius: radius.tileSm,
      backgroundColor: c.soft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    numberBadgeDone: { backgroundColor: c.secondary },
    startLink: {
      ...typography.captionStrong,
      color: c.primary,
      textAlign: 'right',
      marginTop: -spacing.xs,
      marginBottom: spacing.sm,
    },
    numberBadgeLocked: { backgroundColor: c.softer },
    number: { ...typography.captionStrong, color: c.body },
    chapterCopy: { flex: 1, gap: 2 },
    chapterTitle: { ...typography.bodyStrong, color: c.ink },
    chapterMeta: { ...typography.caption, color: c.body },
    lockedText: { color: c.mute },
    lockedLabel: { ...typography.caption, color: c.mute },
    empty: { ...typography.body, color: c.body, textAlign: 'center', paddingVertical: spacing.xxl },

    scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.34)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: c.canvas,
      borderTopLeftRadius: radius.card,
      borderTopRightRadius: radius.card,
      paddingHorizontal: layout.gutter,
      paddingTop: spacing.md,
      paddingBottom: spacing.huge,
    },
    grabber: {
      width: 36,
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: c.pressed,
      alignSelf: 'center',
      marginBottom: spacing.lg,
    },
    sheetTitle: { ...typography.listTitle, color: c.ink, marginBottom: spacing.md },
    levelRow: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    levelRowDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.pressed },
    radio: {
      width: 20,
      height: 20,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: c.pressed,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: { borderColor: c.ink },
    radioDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: c.ink },
    levelRowLabel: { ...typography.body, color: c.ink },
  });

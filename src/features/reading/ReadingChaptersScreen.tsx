// 회독 — 레벨 선택 + 챕터 목록(잠금/진행/완료 + known/total).
// Design Ref: 회독 모드. FSRS와 분리된 독립 학습 경로(보상 없음).

import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { font, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';
import type { JlptLevel } from '~/types/Card';
import { chapterStatus, type ChapterStat, type ChapterStatus } from '~/types/Reading';
import { loadLevelChapterStats } from './buildReadingEngine';

const LEVELS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

const STATUS_LABEL: Record<ChapterStatus, string> = {
  completed: '완료',
  inProgress: '학습 중',
  locked: '잠김',
};

export default function ReadingChaptersScreen(): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const [level, setLevel] = useState<JlptLevel>('N5');
  const [stats, setStats] = useState<ChapterStat[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void loadLevelChapterStats(level).then((s) => {
        if (alive) setStats(s);
      });
      return () => {
        alive = false;
      };
    }, [level]),
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>회독</Text>
      <Text style={styles.subtitle}>빈도순 50단어씩 · 다 외울 때까지 반복</Text>

      <View style={styles.levelRow}>
        {LEVELS.map((lv) => (
          <Pressable
            key={lv}
            style={[styles.levelChip, lv === level && styles.levelChipOn]}
            onPress={() => {
              setStats(null);
              setLevel(lv);
            }}
            accessibilityRole="button"
          >
            <Text style={[styles.levelChipText, lv === level && styles.levelChipTextOn]}>{lv}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {stats === null ? (
          <Text style={styles.muted}>불러오는 중…</Text>
        ) : stats.length === 0 ? (
          <Text style={styles.muted}>이 레벨은 회독 데이터가 없어요.</Text>
        ) : (
          stats.map((s) => {
            const status = chapterStatus(stats, s.chapter);
            const locked = status === 'locked';
            return (
              <Pressable
                key={s.chapter}
                style={[styles.row, locked && styles.rowLocked]}
                disabled={locked}
                onPress={() =>
                  router.push(
                    `/reading-study?level=${level}&chapter=${s.chapter}` as Href,
                  )
                }
                accessibilityRole="button"
              >
                <View style={styles.rowLeft}>
                  <Text style={[styles.chapterNo, locked && styles.mutedText]}>
                    {level}-{s.chapter}
                  </Text>
                  <Text style={[styles.chapterMeta, locked && styles.mutedText]}>
                    {s.known}/{s.total}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <View style={styles.bar}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${s.total ? (s.known / s.total) * 100 : 0}%` },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.status,
                      status === 'completed' && styles.statusDone,
                      locked && styles.mutedText,
                    ]}
                  >
                    {STATUS_LABEL[status]}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.softer, padding: spacing.xl },
  title: { ...typography.screenTitle, color: c.ink, marginTop: spacing.sm },
  subtitle: { ...typography.caption, color: c.body, marginBottom: spacing.xl },
  levelRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  levelChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.pressed,
  },
  levelChipOn: { backgroundColor: c.ink, borderColor: c.ink },
  levelChipText: { ...typography.body, color: c.ink, fontFamily: font.medium },
  levelChipTextOn: { color: c.onInk },
  list: { gap: spacing.sm, paddingBottom: spacing.huge },
  muted: { ...typography.body, color: c.body, textAlign: 'center', marginTop: spacing.xxl },
  mutedText: { color: c.mute },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.canvas,
    borderRadius: radius.skeleton,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    
  },
  rowLocked: { backgroundColor: c.soft },
  rowLeft: { gap: 2 },
  chapterNo: { ...typography.body, color: c.ink, fontFamily: font.semibold },
  chapterMeta: { ...typography.caption, color: c.body },
  rowRight: { alignItems: 'flex-end', gap: spacing.xs, width: 120 },
  bar: { width: '100%', height: 6, borderRadius: 3, backgroundColor: c.soft, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: c.ink },
  status: { ...typography.caption, color: c.body },
  statusDone: { color: c.ink, fontFamily: font.semibold },
});

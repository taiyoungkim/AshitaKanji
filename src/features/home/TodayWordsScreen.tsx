import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HTML_FLOW_PAGE, layout, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { MainTabBar } from '~/components/MainTabBar';
import { useTheme, useThemedStyles } from '~/design/theme';
import { IconChevron } from '~/design/icons';
import { getDatabase } from '~/db/open';
import { SqliteCardRepo } from '~/db/repos/sqlite/SqliteCardRepo';
import { SqliteReviewLogRepo } from '~/db/repos/sqlite/SqliteReviewLogRepo';
import { Grade } from '~/types/Grade';
import type { Word } from '~/types/Card';

interface Row {
  word: Word;
  confused: boolean;
}

export default function TodayWordsScreen(): React.ReactNode {
  const router = useRouter();
  const { colors, name } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = Number(params.sessionId);
  const [rows, setRows] = useState<Row[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!Number.isInteger(sessionId) || sessionId <= 0) {
        setRows([]);
        return;
      }
      let alive = true;
      void (async () => {
        const db = await getDatabase();
        const logs = await new SqliteReviewLogRepo(db).findBySession(sessionId);
        const ids: string[] = [];
        const confused = new Set<string>();
        for (const log of logs) {
          if (!ids.includes(log.word_id)) ids.push(log.word_id);
          if (log.grade === Grade.Again) confused.add(log.word_id);
        }
        const words = await new SqliteCardRepo(db).findByIds(ids);
        const byId = new Map(words.map((word) => [word.id, word]));
        if (!alive) return;
        setRows(ids.flatMap((id) => {
          const word = byId.get(id);
          return word ? [{ word, confused: confused.has(id) }] : [];
        }));
      })();
      return () => { alive = false; };
    }, [sessionId]),
  );

  return (
    <SafeAreaView style={[styles.root, name === 'light' && { backgroundColor: HTML_FLOW_PAGE }]} edges={['top']}>
      <View style={styles.nav}>
        <Pressable
          onPress={() => router.back()}
          style={styles.back}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="오늘으로 돌아가기"
        >
          <IconChevron size={16} color={colors.ink} direction="left" />
          <Text style={styles.backLabel}>오늘</Text>
        </Pressable>
        <Text style={styles.navTitle}>오늘 배운 단어</Text>
        <View style={styles.navSpacer} />
      </View>

      <Text style={styles.lead}>
        방금 학습한 단어를 다시 확인할 수 있어요.{' '}
        <Text style={styles.leadStrong}>복습·회독과는 다른 단순 보기예요.</Text>
      </Text>

      {!rows ? (
        <View style={styles.center}><ActivityIndicator color={colors.body} /></View>
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>오늘 배운 단어가 없어요.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            {rows.map((row) => (
              <View key={row.word.id} style={styles.row}>
                <Text style={styles.surface}>{row.word.surface}</Text>
                <Text style={styles.reading}>{row.word.reading_kana}</Text>
                <Text style={styles.meaning} numberOfLines={1}>{row.word.meaning_ko}</Text>
                {row.confused ? <Text style={styles.flag}>헷갈림</Text> : null}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      <MainTabBar active="home" />
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.softer },
    nav: {
      minHeight: 64,
      paddingHorizontal: layout.gutter,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    back: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: c.canvas,
      paddingHorizontal: spacing.md,
    },
    backLabel: { ...typography.captionStrong, color: c.ink },
    navTitle: { ...typography.cardTitle, color: c.ink },
    navSpacer: { width: 72 },
    lead: {
      ...typography.caption,
      color: c.body,
      paddingHorizontal: layout.gutter,
      marginBottom: spacing.md,
    },
    leadStrong: { color: c.body, fontWeight: '700' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty: { ...typography.body, color: c.body, textAlign: 'center', marginTop: spacing.xxl },
    list: { paddingHorizontal: layout.gutter, paddingBottom: spacing.huge },
    card: { backgroundColor: c.canvas, borderRadius: radius.card, paddingHorizontal: spacing.lg },
    row: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.soft,
    },
    surface: { ...typography.bodyStrong, color: c.ink, minWidth: 64 },
    reading: { ...typography.caption, color: c.mute },
    meaning: { ...typography.caption, color: c.body, flex: 1, textAlign: 'right' },
    flag: {
      ...typography.captionStrong,
      color: c.primary,
      backgroundColor: c.primarySoft,
      overflow: 'hidden',
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
  });

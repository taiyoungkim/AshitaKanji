// Design Ref: Onikan handoff 화면 4 — 메뉴 / 도감 (`5a`).
//
// 상태를 색이 아니라 형태로 구분한다: 완성 = 실물 타일, 만드는 중 = 진행도 + 2px 잉크 테두리,
// 잠김 = "?" + hairline 링. 다크에서도 동일하게 읽힌다.
//
// 리스트를 카드로 감싸지 않는다 — 흰 카드는 "만드는 중" 하나뿐이라 시선이 거기서 시작한다.

import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
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
import { IconGrid, IconList } from '~/design/icons';
import { Button } from '~/components/ui/Button';
import { Card, Overline, ProgressCells, Tile } from '~/components/ui/Surface';
import { buildOnigiriProgressService } from '~/features/onigiri/buildOnigiriProgressService';
import { INGREDIENTS_PER_ONIGIRI } from '~/features/onigiri/catalog';
import { recipeImage } from '~/features/onigiri/recipeAssets';
import {
  computeOnigiriProgress,
  type OnigiriProgressEntry,
  type OnigiriProgressSnapshot,
} from '~/features/onigiri/progress';
import { useSettingsStore } from '~/stores/SettingsStore';

// 전체가 24종이므로 세 자리는 불필요한 자릿수다.
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export default function CollectionScreen(): React.ReactNode {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const view = useSettingsStore((s) => s.collectionView);
  const setView = useSettingsStore((s) => s.setCollectionView);
  const [snapshot, setSnapshot] = useState<OnigiriProgressSnapshot | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setSnapshot(null);
      void buildOnigiriProgressService()
        .then((svc) => svc.getSnapshot())
        .then((next) => {
          if (alive) setSnapshot(next);
        })
        .catch(() => {
          if (alive) setSnapshot(computeOnigiriProgress([]));
        });
      return () => {
        alive = false;
      };
    }, []),
  );

  const openDetail = (entry: OnigiriProgressEntry) => {
    if (entry.status === 'locked') return;
    router.push({ pathname: '/onigiri/[id]', params: { id: entry.item.id } });
  };

  const completed = snapshot?.completedCount ?? 0;
  const total = snapshot?.totalCount ?? 24;
  const current = snapshot?.current ?? null;
  const allCollected = !!snapshot && completed === total;
  const isGrid = view === 'grid';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.head}>
        <Text style={styles.title}>메뉴</Text>
        <Text style={styles.headCount}>
          {completed} / {total}
        </Text>
      </View>

      {!snapshot ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.body} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {current && !allCollected && (
            <Card elevated style={styles.currentCard}>
              <Tile
                size={56}
                cornerRadius={16}
                image={recipeImage(current.item.imageKey)}
                imageSize={46}
              />
              <View style={styles.currentBody}>
                <Overline>만드는 중</Overline>
                <Text style={styles.currentName} numberOfLines={1}>
                  {current.item.name}
                </Text>
                <ProgressCells
                  total={INGREDIENTS_PER_ONIGIRI}
                  filled={current.ingredientCount}
                  height={5}
                  gap={6}
                />
              </View>
              {/* 도감에도 주요 행동이 하나 있다 — 화면의 유일한 오렌지. */}
              <Button
                label="이어서"
                onPress={() => router.push('/study')}
                style={styles.continueBtn}
              />
            </Card>
          )}

          <View style={styles.sectionHead}>
            <Overline>전체 {total}</Overline>
            {/* 전환될 뷰의 아이콘 하나만 보여준다 — 현재 상태를 두 칸으로 그릴 필요가 없다. */}
            <Pressable
              onPress={() => setView(isGrid ? 'list' : 'grid')}
              style={styles.viewToggle}
              accessibilityRole="button"
              accessibilityLabel={isGrid ? '목록으로 보기' : '그리드로 보기'}
            >
              {isGrid ? (
                <IconList size={24} color={colors.body} />
              ) : (
                <IconGrid size={24} color={colors.body} />
              )}
            </Pressable>
          </View>

          {isGrid ? (
            <View style={styles.grid}>
              {snapshot.entries.map((entry) => (
                <GridCell key={entry.item.id} entry={entry} onPress={openDetail} />
              ))}
            </View>
          ) : (
            <View>
              {snapshot.entries.map((entry) => (
                <ListRow key={entry.item.id} entry={entry} onPress={openDetail} />
              ))}
            </View>
          )}

          {allCollected && <Text style={styles.note}>전부 모았네.</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ListRow({
  entry,
  onPress,
}: {
  entry: OnigiriProgressEntry;
  onPress: (entry: OnigiriProgressEntry) => void;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const locked = entry.status === 'locked';
  const status =
    entry.status === 'completed'
      ? '완성'
      : locked
        ? '잠김'
        : `${entry.ingredientCount} / ${INGREDIENTS_PER_ONIGIRI}`;

  return (
    <Pressable
      onPress={() => onPress(entry)}
      disabled={locked}
      style={({ pressed }) => [styles.row, pressed && !locked && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={locked ? '잠긴 메뉴' : `${entry.item.name} 상세 보기`}
    >
      <Text style={[styles.rowIndex, locked && styles.mutedText]}>{pad2(entry.item.order)}</Text>
      <Text style={[styles.rowName, locked && styles.mutedText]} numberOfLines={1}>
        {locked ? '???' : entry.item.name}
      </Text>
      <Text style={[styles.rowStatus, locked && styles.mutedText]}>{status}</Text>
    </Pressable>
  );
}

function GridCell({
  entry,
  onPress,
}: {
  entry: OnigiriProgressEntry;
  onPress: (entry: OnigiriProgressEntry) => void;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const locked = entry.status === 'locked';
  const inProgress = entry.status === 'inProgress';
  const art = recipeImage(entry.item.imageKey);

  return (
    <Pressable
      onPress={() => onPress(entry)}
      disabled={locked}
      style={styles.cell}
      accessibilityRole="button"
      accessibilityLabel={locked ? '잠긴 메뉴' : `${entry.item.name} 상세 보기`}
    >
      {locked ? (
        <View style={[styles.cellTile, styles.cellTileLocked]}>
          <Text style={styles.cellLockMark}>?</Text>
        </View>
      ) : (
        <View style={[styles.cellTile, styles.cellTileFilled, inProgress && styles.cellTileMaking]}>
          {art && <Image source={art} style={styles.cellArt} resizeMode="contain" />}
        </View>
      )}
      <Text style={[styles.cellLabel, locked && styles.mutedText]} numberOfLines={1}>
        {locked ? pad2(entry.item.order) : entry.item.name}
      </Text>
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.softer },
    head: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingHorizontal: layout.gutter,
      paddingTop: spacing.xxl,
    },
    title: { ...typography.screenTitle, color: c.ink },
    headCount: { ...typography.bodyStrong, color: c.body, fontVariant: ['tabular-nums'] },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { flex: 1, marginTop: layout.gutter },
    scrollContent: { paddingHorizontal: layout.gutter, paddingBottom: spacing.huge },

    currentCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
    currentBody: { flex: 1, gap: spacing.sm },
    currentName: { ...typography.cta, color: c.ink },
    continueBtn: { minHeight: layout.touchTarget, paddingHorizontal: 18 },

    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 24,
    },
    viewToggle: {
      width: layout.touchTarget,
      height: layout.touchTarget,
      alignItems: 'center',
      justifyContent: 'center',
      // 아이콘 광학 중심을 "전체 24"와 같은 좌우 마진에 맞춘다.
      marginRight: -11,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      minHeight: 64,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.pressed,
    },
    rowPressed: { opacity: 0.7 },
    rowIndex: { ...typography.caption, color: c.body, width: 28 },
    rowName: { ...typography.listTitle, color: c.ink, flex: 1 },
    rowStatus: { ...typography.captionStrong, color: c.body },
    mutedText: { color: c.mute },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: layout.gapTight, marginTop: spacing.sm },
    // 3열: 좌우 여백을 뺀 폭을 셋으로 나눈다.
    cell: { width: '31.5%', gap: spacing.sm },
    cellTile: {
      aspectRatio: 1,
      borderRadius: radius.tile,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    cellTileFilled: { backgroundColor: c.plate },
    cellTileMaking: { borderWidth: 2, borderColor: c.ink },
    cellTileLocked: { borderWidth: border.chip, borderColor: c.pressed },
    cellLockMark: { fontFamily: font.bold, fontSize: 22, lineHeight: 28, color: c.mute },
    cellArt: { width: 70, height: 70 },
    cellLabel: { fontFamily: font.semibold, fontSize: 14, lineHeight: 18, color: c.ink },

    note: { ...typography.body, color: c.body, textAlign: 'center', marginTop: spacing.xxl },
  });

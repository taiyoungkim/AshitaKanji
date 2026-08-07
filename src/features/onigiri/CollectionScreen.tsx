// Design Ref: ONIGIRI SHOP redesign — 03 Onigiri Collection (Index).
// 컬렉션 진행도는 완료 세션에서 파생(progress.entries). 읽기 전용.

import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing, typography } from '~/design/tokens';
import { buildOnigiriProgressService } from '~/features/onigiri/buildOnigiriProgressService';
import { INGREDIENTS_PER_ONIGIRI } from '~/features/onigiri/catalog';
import {
  IngredientSegments,
  OnigiriIndexItem,
  OnigiriSketch,
} from '~/features/onigiri/components';
import {
  computeOnigiriProgress,
  type OnigiriProgressEntry,
  type OnigiriProgressSnapshot,
} from '~/features/onigiri/progress';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export default function CollectionScreen(): React.ReactNode {
  const router = useRouter();
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
  const allCollected = !!snapshot && completed === total;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={styles.title}>ONIGIRI INDEX</Text>
          <View style={styles.countBlock}>
            <Text style={styles.count}>
              {pad2(completed)} / {total}
            </Text>
            <Text style={styles.countLabel}>완성</Text>
          </View>
        </View>

        {!snapshot ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.text} />
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            <CurrentOnigiriCard
              entry={snapshot.current}
              allCollected={allCollected}
              onPress={openDetail}
            />

            <Text style={[styles.sectionLabel, styles.collectionLabel]}>COLLECTION</Text>
            {snapshot.entries.map((entry, idx) => (
              <View key={entry.item.id}>
                <OnigiriIndexItem entry={entry} onPress={openDetail} />
                {idx < snapshot.entries.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
            {allCollected && <Text style={styles.note}>전부 모았네.</Text>}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

function CurrentOnigiriCard({
  entry,
  allCollected,
  onPress,
}: {
  entry: OnigiriProgressEntry;
  allCollected: boolean;
  onPress: (entry: OnigiriProgressEntry) => void;
}): React.ReactNode {
  return (
    <Pressable
      onPress={() => onPress(entry)}
      accessibilityRole="button"
      accessibilityLabel={`${entry.item.name} 상세 보기, 재료 ${entry.ingredientCount}개`}
    >
      {({ pressed }) => (
        <View style={[styles.currentCard, pressed && styles.currentCardPressed]}>
          <View style={styles.currentHead}>
            <Text style={styles.sectionLabel}>
              {allCollected ? 'ALL COLLECTED' : 'NOW MAKING'}
            </Text>
            <Text style={styles.currentOrder}>
              {String(entry.item.order).padStart(3, '0')}
            </Text>
          </View>

          <Text style={styles.currentName}>{entry.item.name}</Text>
          <OnigiriSketch
            status={entry.status}
            ingredientCount={entry.ingredientCount}
            size={104}
            style={styles.currentSketch}
          />

          <View style={styles.progressHead}>
            <Text style={styles.progressLabel}>INGREDIENTS</Text>
            <Text style={styles.progressCount}>
              {entry.ingredientCount} / {INGREDIENTS_PER_ONIGIRI}
            </Text>
          </View>
          <IngredientSegments
            count={entry.ingredientCount}
            label={false}
            compact
            style={styles.segments}
          />

          <View style={styles.ingredientGrid}>
            {entry.item.ingredients.map((ingredient, index) => {
              const acquired = index < entry.ingredientCount;
              return (
                <View key={ingredient} style={styles.ingredientRow}>
                  <View
                    style={[
                      styles.ingredientDot,
                      acquired && styles.ingredientDotAcquired,
                    ]}
                  />
                  <Text
                    style={[
                      styles.ingredientName,
                      !acquired && styles.ingredientNamePending,
                    ]}
                  >
                    {ingredient}
                  </Text>
                </View>
              );
            })}
          </View>

          {entry.ingredientCount === 0 && !allCollected && (
            <Text style={styles.emptyHint}>학습을 마치면 첫 재료가 들어와.</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    backgroundColor: colors.bg,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  countBlock: {
    alignItems: 'flex-end',
  },
  count: {
    ...typography.small,
    fontFamily: fontFamily.mono,
    color: colors.textSecondary,
  },
  countLabel: {
    ...typography.tiny,
    color: colors.textTertiary,
    marginTop: 2,
  },
  list: {
    flex: 1,
    marginTop: spacing.lg,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  currentCard: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 20,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  currentCardPressed: {
    opacity: 0.72,
  },
  currentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currentOrder: {
    ...typography.small,
    fontFamily: fontFamily.mono,
    color: colors.textSecondary,
  },
  currentName: {
    ...typography.h2,
    color: colors.text,
    marginTop: spacing.xs,
  },
  currentSketch: {
    alignSelf: 'center',
    marginVertical: spacing.sm,
  },
  progressHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    ...typography.tiny,
    color: colors.textSecondary,
  },
  progressCount: {
    ...typography.small,
    fontFamily: fontFamily.mono,
    color: colors.textSecondary,
  },
  segments: {
    marginTop: spacing.sm,
  },
  ingredientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.sm,
    marginTop: spacing.md,
  },
  ingredientRow: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ingredientDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  ingredientDotAcquired: {
    borderColor: colors.text,
    backgroundColor: colors.text,
  },
  ingredientName: {
    ...typography.small,
    color: colors.text,
  },
  ingredientNamePending: {
    color: colors.textTertiary,
  },
  emptyHint: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  sectionLabel: {
    ...typography.tiny,
    color: colors.textSecondary,
  },
  collectionLabel: {
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  note: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});

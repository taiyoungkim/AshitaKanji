// Design Ref: ONIGIRI SHOP redesign — 04 Onigiri Detail.
// id로 카탈로그 항목 조회 + 진행도 스냅샷에서 상태 파생. 읽기 전용.

import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing, typography } from '~/design/tokens';
import { buildOnigiriProgressService } from '~/features/onigiri/buildOnigiriProgressService';
import { getOnigiriById } from '~/features/onigiri/catalog';
import {
  LabelValueRow,
  OnigiriSketch,
  formatOnigiriDate,
} from '~/features/onigiri/components';
import {
  computeOnigiriProgress,
  type OnigiriProgressEntry,
} from '~/features/onigiri/progress';

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

export default function OnigiriDetailScreen(): React.ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entry, setEntry] = useState<OnigiriProgressEntry | null>(null);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoaded(false);
      const resolve = (
        snap: ReturnType<typeof computeOnigiriProgress>,
      ): void => {
        if (!alive) return;
        setEntry(snap.entries.find((e) => e.item.id === id) ?? null);
        setLoaded(true);
      };
      void buildOnigiriProgressService()
        .then((svc) => svc.getSnapshot())
        .then(resolve)
        .catch(() => resolve(computeOnigiriProgress([])));
      return () => {
        alive = false;
      };
    }, [id]),
  );

  if (!loaded) {
    return (
      <SafeAreaView style={styles.root} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      </SafeAreaView>
    );
  }

  const item = entry?.item ?? getOnigiriById(id ?? '');
  if (!item) {
    return (
      <SafeAreaView style={styles.root} edges={['bottom']}>
        <View style={styles.center}>
          <Text style={styles.note}>찾을 수 없는 오니기리야.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const status = entry?.status ?? 'locked';
  const locked = status === 'locked';
  const completed = status === 'completed';

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={[styles.no, locked && styles.tertiary]}>{pad3(item.order)}</Text>
          <Text style={[styles.name, locked && styles.lockedName]}>
            {locked ? 'LOCKED' : item.name}
          </Text>
        </View>

        <View style={styles.sketch}>
          <OnigiriSketch
            status={status}
            ingredientCount={entry?.ingredientCount ?? 0}
            size={150}
          />
        </View>

        {completed ? (
          <LabelValueRow
            label="COMPLETED"
            value={entry?.completedAt ? formatOnigiriDate(entry.completedAt) : '— —'}
            valueSize="small"
            valueStyle={styles.mono}
          />
        ) : locked ? (
          <LabelValueRow label="COMPLETED" value="— —" valueSize="small" mutedValue valueStyle={styles.mono} />
        ) : (
          <LabelValueRow
            label="IN PROGRESS"
            value={`${entry?.ingredientCount ?? 0} / 4`}
            valueSize="small"
            valueStyle={styles.mono}
          />
        )}

        {!locked && (
          <View style={styles.ingredients}>
            <Text style={styles.ingredientsLabel}>Ingredients</Text>
            <View style={styles.ingredientList}>
              {item.ingredients.map((ing, idx) => {
                const acquired = completed || idx < (entry?.ingredientCount ?? 0);
                return (
                  <Text
                    key={ing}
                    style={[styles.ingredient, !acquired && styles.tertiary]}
                  >
                    {ing}
                  </Text>
                );
              })}
            </View>
          </View>
        )}

        {completed && <Text style={styles.description}>{item.description}</Text>}
        {!completed && !locked && (
          <Text style={styles.hint}>획득한 재료만 진하게 표시.</Text>
        )}
        {locked && <Text style={styles.lockNote}>아직 잠겨 있어.</Text>}

        <View style={styles.spacer} />
      </View>
    </SafeAreaView>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  head: {
    marginTop: spacing.xs,
  },
  no: {
    ...typography.small,
    fontFamily: fontFamily.mono,
    color: colors.textSecondary,
  },
  name: {
    ...typography.h1,
    color: colors.text,
    marginTop: 6,
  },
  lockedName: {
    color: colors.textTertiary,
    letterSpacing: 1,
  },
  tertiary: {
    color: colors.textTertiary,
  },
  sketch: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  mono: {
    fontFamily: fontFamily.mono,
  },
  ingredients: {
    marginTop: spacing.md,
  },
  ingredientsLabel: {
    ...typography.tiny,
    color: colors.textSecondary,
  },
  ingredientList: {
    marginTop: spacing.sm,
    gap: 6,
  },
  ingredient: {
    ...typography.body,
    color: colors.text,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  hint: {
    ...typography.small,
    color: colors.textTertiary,
    marginTop: spacing.lg,
  },
  lockNote: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  note: {
    ...typography.small,
    color: colors.textSecondary,
  },
  spacer: {
    flex: 1,
  },
});

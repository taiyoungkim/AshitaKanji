// Design Ref: ONIGIRI SHOP redesign — 03 Onigiri Collection (Index).
// 컬렉션 진행도는 완료 세션에서 파생(progress.entries). 읽기 전용.

import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing, typography } from '~/design/tokens';
import { buildOnigiriProgressService } from '~/features/onigiri/buildOnigiriProgressService';
import { OnigiriIndexItem } from '~/features/onigiri/components';
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
  const isEmpty = !!snapshot && completed === 0;
  const allCollected = !!snapshot && completed === total;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={styles.title}>ONIGIRI INDEX</Text>
          <Text style={styles.count}>
            {pad2(completed)} / {total}
          </Text>
        </View>

        {!snapshot ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.text} />
          </View>
        ) : isEmpty ? (
          <View style={styles.center}>
            <Text style={styles.note}>아직 만든 오니기리가 없어.</Text>
            <Text style={[styles.note, styles.noteTertiary]}>학습을 마치면 재료가 모여.</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
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
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  count: {
    ...typography.small,
    fontFamily: fontFamily.mono,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  list: {
    flex: 1,
    marginTop: spacing.md,
  },
  listContent: {
    paddingBottom: spacing.xl,
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
  noteTertiary: {
    color: colors.textTertiary,
    marginTop: 0,
  },
});

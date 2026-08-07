// Design Ref: ONIGIRI SHOP redesign — Study Complete + Receipt View.
// Session summary stays in SessionStore while this full-screen modal is open.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  buttons,
  colors,
  fontFamily,
  fontWeight,
  motion,
  spacing,
  typography,
} from '~/design/tokens';
import { buildOnigiriProgressService } from '~/features/onigiri/buildOnigiriProgressService';
import { catImages } from '~/features/onigiri/catAssets';
import { INGREDIENTS_PER_ONIGIRI } from '~/features/onigiri/catalog';
import {
  IngredientSegments,
  Receipt,
  type ReceiptRow,
} from '~/features/onigiri/components';
import type {
  OnigiriIngredientReward,
  OnigiriProgressEntry,
  OnigiriProgressSnapshot,
} from '~/features/onigiri/progress';
import { useSessionStore } from '~/stores/SessionStore';
import { buildDoneRewardPresentation } from './rewardPresentation';

function formatReceiptDate(ms: number): string {
  const date = new Date(ms);
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

function buildReceiptText(dateLabel: string, rows: readonly ReceiptRow[]): string {
  const visibleRows = rows.filter((row) => row.value !== null && row.value !== undefined && row.value !== '');
  return [
    'ONIGIRI SHOP',
    dateLabel,
    '',
    ...visibleRows.map((row) => `${row.label}: ${row.value}`),
    '',
    'THANK YOU.',
  ].join('\n');
}

function findRewardForSession(
  progress: OnigiriProgressSnapshot | null,
  sessionId: number | null,
): OnigiriIngredientReward | null {
  const reward = progress?.lastReward ?? null;
  if (!reward) return null;
  if (sessionId === null) return reward;
  return reward.sessionId === sessionId ? reward : null;
}

function findDisplayEntry(
  progress: OnigiriProgressSnapshot | null,
  reward: OnigiriIngredientReward | null,
): OnigiriProgressEntry | null {
  if (!progress) return null;
  if (!reward) return progress.current;
  return progress.entries.find((entry) => entry.item.id === reward.item.id) ?? progress.current;
}

export default function DoneScreen(): React.ReactNode {
  const router = useRouter();
  const summary = useSessionStore((s) => s.summary);
  const resetSession = useSessionStore((s) => s.reset);
  const [progress, setProgress] = useState<OnigiriProgressSnapshot | null>(null);
  const [progressFailed, setProgressFailed] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const rewardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    setProgressFailed(false);
    void buildOnigiriProgressService()
      .then((svc) => svc.getSnapshot())
      .then((snapshot) => {
        if (alive) setProgress(snapshot);
      })
      .catch(() => {
        if (alive) setProgressFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [summary?.sessionId]);

  const reward = findRewardForSession(progress, summary?.sessionId ?? null);
  const displayEntry = findDisplayEntry(progress, reward);
  const dateMs = reward?.earnedAt ?? Date.now();
  const dateLabel = formatReceiptDate(dateMs);
  const newCount = summary?.newCount ?? 0;
  const reviewCount = summary?.reviewCount ?? 0;
  const ingredientName = reward?.ingredient ?? null;
  const onigiriName = reward?.item.name ?? displayEntry?.item.name ?? 'ONIGIRI';
  const ingredientCount = reward
    ? reward.ingredientIndex + 1
    : displayEntry?.ingredientCount ?? 0;
  const remainingIngredients = Math.max(0, INGREDIENTS_PER_ONIGIRI - ingredientCount);
  const allCollected =
    !!progress && progress.completedCount === progress.totalCount;
  const rewardPresentation = buildDoneRewardPresentation({
    ingredientName,
    onigiriName,
    crafted: reward?.crafted ?? false,
    allCollected,
    failed: progressFailed,
  });

  useEffect(() => {
    if (!progress && !progressFailed) return;
    rewardAnim.setValue(0);
    Animated.timing(rewardAnim, {
      toValue: 1,
      duration: motion.durationMs,
      useNativeDriver: true,
    }).start();
  }, [progress, progressFailed, rewardAnim]);

  const receiptRows = useMemo<ReceiptRow[]>(
    () => [
      { label: 'NEW WORDS', value: newCount },
      { label: 'REVIEWS', value: reviewCount },
      { label: 'INGREDIENT', value: ingredientName ?? 'NONE' },
      { label: 'CRAFTED', value: reward?.crafted ? onigiriName : null },
      { label: 'STREAK', value: summary && summary.streakDays > 0 ? summary.streakDays : null },
    ],
    [ingredientName, newCount, onigiriName, reviewCount, reward?.crafted, summary],
  );

  const goMenu = () => {
    resetSession();
    // /done·/study fullScreenModal 스택을 먼저 전부 닫아야 함. dismissTo('/collection')는
    // 히스토리에 collection이 없으면(홈→학습→완료 흐름) push로 폴백 → 탭바 없는
    // collection이 모달처럼 뜸(과거 replace('/home') 사고와 동일 부류). dismissAll로
    // (tabs) 루트에 랜딩한 뒤 collection 탭으로 전환.
    if (router.canDismiss()) router.dismissAll();
    router.replace('/collection');
  };

  const shareReceipt = () => {
    void Share.share({ message: buildReceiptText(dateLabel, receiptRows) }).catch((err: unknown) => {
      console.warn('[receipt] share failed:', err);
    });
  };

  if (showReceipt) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.receiptBody}>
          <Receipt dateLabel={dateLabel} rows={receiptRows} />
        </View>
        <View style={styles.receiptActions}>
          <ActionButton
            label="Back"
            variant="secondary"
            onPress={() => setShowReceipt(false)}
            style={styles.receiptActionButton}
          />
          <ActionButton
            label="Share"
            variant="secondary"
            onPress={shareReceipt}
            style={styles.receiptActionButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.completeScroll}
        contentContainerStyle={styles.completeBody}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>COMPLETED</Text>

        <View style={styles.rows}>
          <SummaryRow label="NEW WORDS" value={newCount} />
          <SummaryRow label="REVIEWS" value={reviewCount} />
        </View>

        <View style={styles.rewardStage}>
          {!progress && !progressFailed ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Animated.View
              style={[
                styles.rewardContent,
                {
                  opacity: rewardAnim,
                  transform: [
                    {
                      translateY: rewardAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [8, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Image
                source={catImages[rewardPresentation.catPose]}
                resizeMode="contain"
                style={styles.rewardCat}
              />
              <View style={styles.rewardCopy}>
                <Text style={styles.rewardKicker}>{rewardPresentation.kicker}</Text>
                <Text style={styles.rewardName}>{rewardPresentation.title}</Text>
                <Text style={styles.rewardNote}>{rewardPresentation.note}</Text>
              </View>
            </Animated.View>
          )}
        </View>

        {progress && !progressFailed && (
          <View style={styles.onigiriProgress}>
            <View style={styles.progressHead}>
              <Text style={styles.onigiriName}>{onigiriName}</Text>
              <Text style={styles.progressCount}>
                {ingredientCount} / {INGREDIENTS_PER_ONIGIRI}
              </Text>
            </View>
            <IngredientSegments count={ingredientCount} compact label={false} />
            <Text style={styles.remaining}>
              {reward?.crafted
                ? '오늘 완성한 오니기리'
                : remainingIngredients > 0
                  ? `완성까지 ${remainingIngredients}번 남음`
                  : '모든 재료를 모았어.'}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <ActionButton label="메뉴에서 보기" variant="primary" onPress={goMenu} />
        <ActionButton label="영수증 보기" variant="secondary" onPress={() => setShowReceipt(true)} />
      </View>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | number }): React.ReactNode {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function ActionButton({
  label,
  variant,
  onPress,
  style,
}: {
  label: string;
  variant: 'primary' | 'secondary';
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}): React.ReactNode {
  const primary = variant === 'primary';
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionButton,
        primary ? styles.primaryButton : styles.secondaryButton,
        style,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.actionText, primary ? styles.primaryText : styles.secondaryText]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  completeScroll: {
    flex: 1,
  },
  completeBody: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  kicker: {
    ...typography.tiny,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: spacing.lg,
  },
  rows: {
    gap: 0,
  },
  summaryRow: {
    minHeight: 54,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    ...typography.tiny,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.h2,
    fontWeight: fontWeight.medium,
    color: colors.text,
    textAlign: 'right',
  },
  rewardStage: {
    minHeight: 142,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  rewardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rewardCat: {
    width: 92,
    height: 104,
  },
  rewardCopy: {
    flex: 1,
  },
  rewardKicker: {
    ...typography.tiny,
    color: colors.textSecondary,
  },
  rewardName: {
    ...typography.h2,
    color: colors.text,
    marginTop: spacing.xs,
  },
  rewardNote: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  onigiriProgress: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  progressHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  onigiriName: {
    ...typography.h2,
    flex: 1,
    color: colors.text,
  },
  progressCount: {
    ...typography.small,
    fontFamily: fontFamily.mono,
    color: colors.textSecondary,
  },
  remaining: {
    ...typography.small,
    color: colors.textSecondary,
  },
  actions: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  actionButton: {
    minHeight: 56,
    borderRadius: buttons.primary.borderRadius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: buttons.primary.paddingHorizontal,
  },
  primaryButton: {
    backgroundColor: buttons.primary.backgroundColor,
    borderColor: buttons.primary.borderColor,
  },
  secondaryButton: {
    backgroundColor: buttons.secondary.backgroundColor,
    borderColor: buttons.secondary.borderColor,
  },
  pressed: {
    opacity: 0.72,
  },
  actionText: {
    ...typography.body,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
  },
  primaryText: {
    color: buttons.primary.color,
  },
  secondaryText: {
    color: buttons.secondary.color,
  },
  receiptBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  receiptActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  receiptActionButton: {
    flex: 1,
  },
});

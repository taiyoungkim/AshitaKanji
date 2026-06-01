// Design Ref: ONIGIRI SHOP redesign — Study Complete + Receipt View.
// Session summary stays in SessionStore while this full-screen modal is open.

import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
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
  fontWeight,
  spacing,
  typography,
} from '~/design/tokens';
import { buildOnigiriProgressService } from '~/features/onigiri/buildOnigiriProgressService';
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
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    let alive = true;
    void buildOnigiriProgressService()
      .then((svc) => svc.getSnapshot())
      .then((snapshot) => {
        if (alive) setProgress(snapshot);
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

  const goShop = () => {
    resetSession();
    // /done·/study는 fullScreenModal — replace('/home')하면 홈이 모달로 떠 팝업처럼 보임.
    // 모달 스택을 닫아 (tabs) 루트(홈)로 랜딩.
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/home');
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
      <View style={styles.completeBody}>
        <Text style={styles.kicker}>COMPLETED</Text>

        <View style={styles.rows}>
          <SummaryRow label="NEW WORDS" value={newCount} />
          <SummaryRow label="REVIEWS" value={reviewCount} />
          <SummaryRow label="INGREDIENT" value={ingredientName ?? 'NONE'} />
        </View>

        <View style={styles.onigiri}>
          {reward?.crafted && <Text style={styles.craftedTag}>CRAFTED</Text>}
          <Text style={styles.onigiriName}>{onigiriName}</Text>
          <IngredientSegments count={ingredientCount} compact />
        </View>
      </View>

      <View style={styles.actions}>
        <ActionButton label="View Receipt" variant="primary" onPress={() => setShowReceipt(true)} />
        <ActionButton label="Back to Shop" variant="secondary" onPress={goShop} />
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
  completeBody: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  kicker: {
    ...typography.tiny,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: spacing.xxl,
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
  onigiri: {
    alignItems: 'center',
    marginTop: spacing.huge,
    gap: spacing.md,
  },
  craftedTag: {
    ...typography.tiny,
    color: colors.textSecondary,
  },
  onigiriName: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
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

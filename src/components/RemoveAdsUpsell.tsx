// 광고 제거 한 줄 제안 — 그날 첫 광고를 막 본 완료 화면에서만 보인다.
// 마운트 시 takeUpsell()로 1회 소비하므로 완료 화면이 뜰 때 함께 마운트해야 한다.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { spacing, typography, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';
import { takeUpsell } from '~/lib/ads/interstitialManager';
import { useAdFreeStore } from '~/lib/ads/entitlement';
import { useRemoveAdsPurchase } from '~/features/settings/useRemoveAdsPurchase';

export function RemoveAdsUpsell({ style }: { style?: StyleProp<ViewStyle> }): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const [upsell] = useState(takeUpsell);
  const adFree = useAdFreeStore((s) => s.adFree);
  const { purchase, busy } = useRemoveAdsPurchase();

  if (!upsell || adFree) return null;
  return (
    <Pressable
      onPress={purchase}
      disabled={busy}
      style={({ pressed }) => [styles.link, pressed && styles.pressed, style]}
      accessibilityRole="button"
    >
      <Text style={styles.label}>광고 없이 공부하기 · 한 번 결제 ›</Text>
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    link: { marginTop: spacing.lg, paddingVertical: spacing.sm },
    pressed: { opacity: 0.6 },
    label: { ...typography.body, color: c.mute, textDecorationLine: 'underline' },
  });

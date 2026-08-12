// Design Ref: Onikan handoff 화면 5 — 레시피 상세 (`8a`).
//
// 막다른 화면을 만들지 않는다. 하단의 "오늘 학습 시작"이 다음 재료를 받는 유일한 방법으로
// 곧장 이어진다 — 이 화면의 유일한 오렌지.
//
// 잠긴 재료는 그림을 감춘다: 썸네일을 hairline 링 + "?" 로 통일하고 일러스트를 노출하지
// 않는다. 무엇을 받게 되는지 그림으로 미리 보여주지 않고, 이름만 남겨 순서만 알려준다.

import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { font, layout, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import { IconChevron } from '~/design/icons';
import { Button } from '~/components/ui/Button';
import { Card, Overline, ProgressSegments, PlateTile } from '~/components/ui/Surface';
import { buildOnigiriProgressService } from '~/features/onigiri/buildOnigiriProgressService';
import { getOnigiriById, INGREDIENTS_PER_ONIGIRI } from '~/features/onigiri/catalog';
import { ingredientImage, ingredientName } from '~/features/onigiri/ingredientAssets';
import { recipeImage } from '~/features/onigiri/recipeAssets';
import {
  computeOnigiriProgress,
  type OnigiriProgressEntry,
} from '~/features/onigiri/progress';
import { remainingCaption } from '~/features/home/homePresentation';
import { buildIngredientPresentation } from './ingredientPresentation';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export default function OnigiriDetailScreen(): React.ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [entry, setEntry] = useState<OnigiriProgressEntry | null>(null);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoaded(false);
      const resolve = (snap: ReturnType<typeof computeOnigiriProgress>): void => {
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

  const item = entry?.item ?? getOnigiriById(id ?? '');
  const status = entry?.status ?? 'locked';
  const acquired = entry?.ingredientCount ?? 0;
  const remaining = Math.max(0, INGREDIENTS_PER_ONIGIRI - acquired);
  const nextIngredient = entry?.nextIngredient ?? null;

  const overline =
    status === 'completed' ? '완성' : status === 'locked' ? '잠김' : '만드는 중';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* 뒤로는 44pt 셰브론만 — '＜ 뒤로' 알약은 iOS 관례와 어긋나고 폭을 낭비한다. */}
      <View style={styles.nav}>
        <Pressable
          onPress={() => router.back()}
          style={styles.navBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
        >
          <IconChevron size={24} color={colors.ink} direction="left" />
        </Pressable>
        <Text style={styles.navTitle}>ONIGIRI</Text>
        <View style={styles.navSpacer} />
      </View>

      {!loaded ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.body} />
        </View>
      ) : !item ? (
        <View style={styles.center}>
          <Text style={styles.note}>찾을 수 없는 메뉴예요.</Text>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.index}>{pad2(item.order)}</Text>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{status === 'locked' ? '???' : item.name}</Text>
              <Text style={styles.count}>
                {acquired} / {INGREDIENTS_PER_ONIGIRI}
              </Text>
            </View>

            <Card variant="elevated" style={styles.summaryCard}>
              <PlateTile
                size={88}
                cornerRadius={radius.tile}
                locked={status === 'locked'}
                image={recipeImage(item.imageKey)}
                imageSize={72}
              />
              <View style={styles.summaryBody}>
                <Overline>{overline}</Overline>
                <ProgressSegments
                  total={INGREDIENTS_PER_ONIGIRI}
                  filled={acquired}
                  height={6}
                  gap={6}
                />
                <Text style={styles.summaryCaption}>
                  {status === 'completed' ? '다 만들었어요' : remainingCaption(remaining)}
                </Text>
              </View>
            </Card>

            <View style={styles.listHead}>
              <Overline>재료 {INGREDIENTS_PER_ONIGIRI}</Overline>
            </View>

            <View>
              {buildIngredientPresentation(
                item.ingredients,
                acquired,
                status === 'completed',
              ).map(({ name: key, state }, index) => {
                const got = state === 'acquired';
                const isNext = state === 'next';
                return (
                  <View key={`${key}-${index}`} style={styles.ingredientRow}>
                    {got ? (
                      <PlateTile
                        size={44}
                        cornerRadius={radius.tileSm}
                        image={ingredientImage(key)}
                        imageSize={38}
                      />
                    ) : (
                      <PlateTile size={44} cornerRadius={radius.tileSm} locked />
                    )}
                    <Text
                      style={[
                        styles.ingredientName,
                        got ? styles.ingredientGot : isNext ? styles.ingredientNext : styles.ingredientPending,
                      ]}
                      numberOfLines={1}
                    >
                      {ingredientName(key)}
                    </Text>
                    {got ? (
                      <Text style={styles.gotLabel}>받았어요</Text>
                    ) : isNext ? (
                      <View style={styles.nextPill}>
                        <Text style={styles.nextPillLabel}>다음</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <View style={styles.spacer} />

            {/* NEXT REWARD 를 카드에서 해제했다 — 회색 박스로 두면 카드 안 카드가 된다. */}
            {nextIngredient && status !== 'completed' && (
              <View style={styles.nextRewardRow}>
                <PlateTile size={52} cornerRadius={16} locked />
                <View style={styles.nextRewardCopy}>
                  <Overline>다음 보상</Overline>
                  <Text style={styles.nextRewardLine}>
                    {ingredientName(nextIngredient)} · 오늘 학습을 마치면
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.cta}>
            <Button label="오늘 학습 시작" onPress={() => router.push('/study')} />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.softer },
    nav: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: spacing.sm,
      paddingHorizontal: layout.gapTight,
    },
    navBack: {
      width: layout.touchTarget,
      height: layout.touchTarget,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // 오른쪽 44 스페이서로 워드마크를 광학 중앙에 둔다.
    navTitle: {
      flex: 1,
      textAlign: 'center',
      fontFamily: font.semibold,
      fontSize: 15,
      lineHeight: 20,
      letterSpacing: 1.4,
      color: c.body,
    },
    navSpacer: { width: layout.touchTarget },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    note: { ...typography.body, color: c.body },

    scroll: { flex: 1 },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: layout.gutter,
      paddingTop: layout.gapTight,
      paddingBottom: spacing.lg,
    },
    index: {
      ...typography.caption,
      color: c.body,
      letterSpacing: 1.4,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: spacing.md,
      marginTop: spacing.xs,
    },
    title: { ...typography.resultTitle, color: c.ink, flexShrink: 1 },
    count: { ...typography.bodyStrong, color: c.body, fontVariant: ['tabular-nums'] },

    summaryCard: {
      marginTop: layout.gutter,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18,
      paddingVertical: 22,
      paddingHorizontal: layout.gutter,
    },
    summaryBody: { flex: 1, gap: 10 },
    summaryCaption: { ...typography.body, color: c.body },

    listHead: { marginTop: layout.gapGroup, marginBottom: spacing.xs },
    ingredientRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      minHeight: 68,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.pressed,
    },
    ingredientName: { ...typography.cta, flex: 1 },
    ingredientGot: { color: c.ink },
    ingredientNext: { color: c.body },
    ingredientPending: { color: c.mute },
    gotLabel: { ...typography.captionStrong, color: c.body },
    nextPill: {
      backgroundColor: c.soft,
      borderRadius: radius.pill,
      paddingVertical: 6,
      paddingHorizontal: spacing.md,
    },
    nextPillLabel: { ...typography.captionStrong, color: c.ink },

    spacer: { flex: 1, minHeight: spacing.xxl },

    nextRewardRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: layout.gutter },
    nextRewardCopy: { flex: 1, gap: spacing.xs },
    nextRewardLine: { ...typography.cta, color: c.ink },

    cta: { paddingHorizontal: layout.gutter, paddingBottom: layout.gapGroup },
  });

// Design Ref: Onikan handoff 화면 3 — 학습 완료 결과(`2a`) + 영수증(`7a`).
//
// 영수증은 선택지가 아니라 결과물이다. 두 번째 버튼으로 두면 화면에 액션이 둘이 되어
// 선택을 강요한다. 하나뿐인 CTA 의 결과로 만들면 매일 반드시 한 번은 보게 된다.
//
// 오버레이가 뜨면 아래 CTA 는 **렌더에서 제외**한다. 투명도로 가리면 스크림 뒤로
// 오렌지가 비쳐 화면에 오렌지가 둘이 된다.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import {
  font,
  layout,
  motion,
  radius,
  spacing,
  typography,
  type ThemeColors,
} from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import { Button } from '~/components/ui/Button';
import { ButtonFillProgress } from '~/components/ui/ButtonFillProgress';
import { StatTile } from '~/components/ui/StatTile';
import { Card, Overline, ProgressSegments, PlateTile } from '~/components/ui/Surface';
import { useToast } from '~/components/Toast';
import { buildOnigiriProgressService } from '~/features/onigiri/buildOnigiriProgressService';
import { INGREDIENTS_PER_ONIGIRI } from '~/features/onigiri/catalog';
import { Receipt, type ReceiptRow } from '~/features/onigiri/components';
import { ingredientImage, ingredientName } from '~/features/onigiri/ingredientAssets';
import { recipeImage } from '~/features/onigiri/recipeAssets';
import type { OnigiriImageKey } from '~/features/onigiri/types';
import type {
  OnigiriIngredientReward,
  OnigiriProgressEntry,
  OnigiriProgressSnapshot,
} from '~/features/onigiri/progress';
import { remainingCaption } from '~/features/home/homePresentation';
import { useSessionStore } from '~/stores/SessionStore';
import { useFullScreenInsets } from '~/hooks/useScreenInsets';
import { useReducedMotion } from '~/hooks/useReducedMotion';
import { AnimatedNumber } from '~/components/ui/AnimatedNumber';
import { RewardBurst } from './components/RewardBurst';
import {
  planRewardMotion,
  rewardMotionKey,
  REWARD_TIMELINE,
  PROGRESS_CELL_LIME_HOLD,
} from './rewardMotion';
import { buildDoneRewardPresentation, findRewardForSession } from './rewardPresentation';
import { captureReceipt, saveReceiptImage, shareReceiptImage } from './receiptCapture';
import { isVisualCaptureEnabled, VISUAL_NOW_MS } from '~/visual/captureFixtures';

// fullScreenModal 안에서는 useSafeAreaInsets()가 0을 주는 경우가 있어,
// 디바이스 실제 inset 을 직접 사용한다.

// 영수증 날짜는 final-screens 07 기준 `2026. 8. 7` — 시각은 넣지 않는다.
function formatReceiptDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
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
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const screenInsets = useFullScreenInsets();
  const toast = useToast();
  const { height: windowHeight } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const { uiFixture } = useLocalSearchParams<{ uiFixture?: string }>();
  const captureMode = isVisualCaptureEnabled() && uiFixture != null;
  const summary = useSessionStore((s) => s.summary);
  const resetSession = useSessionStore((s) => s.reset);
  const [progress, setProgress] = useState<OnigiriProgressSnapshot | null>(null);
  const [progressFailed, setProgressFailed] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(captureMode && uiFixture === '07-receipt');
  const [craftedOpen, setCraftedOpen] = useState(captureMode && uiFixture === '06-onigiri-complete');
  const receiptRef = useRef<View>(null);

  // 접근성 설정 확인 전에도 결과가 보이도록 최종 상태에서 시작한다.
  const art = useRef(new Animated.Value(1)).current;
  const recipeIn = useRef(new Animated.Value(1)).current;
  const limeFade = useRef(new Animated.Value(1)).current;
  const noteIn = useRef(new Animated.Value(1)).current;
  const ctaIn = useRef(new Animated.Value(1)).current;
  const dim = useRef(new Animated.Value(1)).current;
  const print = useRef(new Animated.Value(1)).current;

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

  // 스와이프/뒤로가기로 빠져도 다음 /study 가 남은 summary 에 묶이지 않게 정리한다.
  useEffect(() => {
    return navigation.addListener('beforeRemove', () => {
      useSessionStore.getState().reset();
    });
  }, [navigation]);

  const reward = findRewardForSession(progress, summary?.sessionId ?? null);
  const displayEntry = findDisplayEntry(progress, reward);
  const dateMs = captureMode ? VISUAL_NOW_MS : (reward?.earnedAt ?? Date.now());
  const dateLabel = formatReceiptDate(dateMs);
  const newCount = summary?.newCount ?? 0;
  const againCount = summary?.againCount ?? 0;
  const rewardKey = reward?.ingredient ?? null;
  const rewardLabel = rewardKey ? ingredientName(rewardKey) : null;
  const recipeName = reward?.item.name ?? displayEntry?.item.name ?? '오니기리';
  const ingredientCount = reward ? reward.ingredientIndex + 1 : (displayEntry?.ingredientCount ?? 0);
  const remaining = Math.max(0, INGREDIENTS_PER_ONIGIRI - ingredientCount);
  const allCollected = !!progress && progress.completedCount === progress.totalCount;
  const streakDays = summary?.streakDays ?? 0;

  const presentation = buildDoneRewardPresentation({
    ingredientName: rewardLabel,
    onigiriName: recipeName,
    // 결과 영수증과 완성 축하는 별도 단계다. 첫 화면은 항상 획득한 재료를 설명한다.
    crafted: false,
    allCollected,
    failed: progressFailed,
  });

  const memorizedNote =
    newCount > 0 ? `오늘 외운 ${newCount}개는 내일 다시 확인해요.` : '내일 또 만나요.';

  // 보상 시퀀스는 세션·재료 조합이 바뀔 때만 돈다.
  // 영수증을 열었다 닫아도 이 키가 그대로면 재실행하지 않는다.
  const motionKey = rewardMotionKey({
    sessionId: summary?.sessionId ?? null,
    itemId: reward?.item.id ?? null,
    ingredientIndex: reward?.ingredientIndex ?? null,
  });
  const plan = planRewardMotion({
    hasReward: rewardKey !== null,
    ingredientCount,
    reducedMotion: reducedMotion === true,
  });
  const playedKeyRef = useRef<string | null>(null);

  // 진입 연출 — 재료 아트가 떠오르고, 레시피·안내문·CTA 가 순서대로 붙는다.
  useEffect(() => {
    if (!progress && !progressFailed) return;
    if (reducedMotion === null) return;
    if (playedKeyRef.current === motionKey) return;
    playedKeyRef.current = motionKey;

    const values = [art, recipeIn, limeFade, noteIn, ctaIn];
    for (const v of values) v.stopAnimation();

    if (reducedMotion) {
      // 모션 감소: 카운트업·드로잉·링 없이 최종 상태만. 정보량은 동일하다.
      for (const v of values) v.setValue(1);
      return;
    }

    for (const v of values) v.setValue(0);
    const track = (value: Animated.Value, name: keyof typeof REWARD_TIMELINE, native = true) =>
      Animated.timing(value, {
        toValue: 1,
        delay: REWARD_TIMELINE[name].delay,
        duration: REWARD_TIMELINE[name].duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: native,
      });

    const animation = Animated.parallel([
      track(art, 'art'),
      track(recipeIn, 'recipe'),
      // 배경색 보간이라 네이티브 드라이버를 쓸 수 없다.
      track(limeFade, 'progressCell', false),
      track(noteIn, 'note'),
      track(ctaIn, 'cta'),
    ]);
    animation.start();
    return () => animation.stop();
  }, [
    progress,
    progressFailed,
    reducedMotion,
    motionKey,
    art,
    recipeIn,
    limeFade,
    noteIn,
    ctaIn,
  ]);

  const receiptRows = useMemo<ReceiptRow[]>(
    () => [
      { label: '새로 배운 단어', value: newCount },
      { label: '다시 배울 단어', value: againCount },
      { label: '받은 재료', value: rewardLabel, reward: true },
    ],
    [newCount, againCount, rewardLabel],
  );

  const goHome = () => {
    resetSession();
    // 결과 화면은 스택에서 제거한다 — 뒤로가기·스와이프로 되돌아오지 않게.
    if (router.canDismiss()) router.dismissAll();
    router.replace('/home');
  };

  const openReceipt = () => {
    setReceiptOpen(true);
    dim.stopAnimation();
    print.stopAnimation();
    if (reducedMotion !== false) {
      dim.setValue(1);
      print.setValue(1);
      return;
    }

    dim.setValue(0);
    print.setValue(0);
    Animated.parallel([
      Animated.timing(dim, {
        toValue: 1,
        duration: motion.dimInMs,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(print, {
        toValue: 1,
        delay: motion.receiptPrintDelayMs,
        duration: motion.receiptPrintMs,
        // 위에서 인쇄되어 내려오는 느낌.
        easing: Easing.bezier(0.5, 0, 0.25, 1),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const advanceFromResult = () => {
    if (reward?.crafted) setCraftedOpen(true);
    else openReceipt();
  };

  const onSave = () => {
    void (async () => {
      const uri = await captureReceipt(receiptRef);
      if (!uri) {
        toast.show('영수증을 이미지로 만들지 못했어요');
        return;
      }
      const ok = await saveReceiptImage(uri);
      toast.show(ok ? '사진 앨범에 저장했어요' : '저장 권한이 없어요');
    })();
  };

  const onShare = () => {
    void (async () => {
      const uri = await captureReceipt(receiptRef);
      if (uri && (await shareReceiptImage(uri))) return;
      // 이미지 공유가 막히면 최소한 글로라도 나가게 한다.
      await Share.share({
        message: [
          'ONIGIRI SHOP',
          dateLabel,
          `새로 배운 단어 ${newCount}`,
          `다시 배울 단어 ${againCount}`,
          rewardLabel ? `받은 재료 ${rewardLabel}` : null,
          `${recipeName} ${ingredientCount}/${INGREDIENTS_PER_ONIGIRI}`,
        ]
          .filter(Boolean)
          .join('\n'),
      }).catch((err: unknown) => console.warn('[receipt] share failed:', err));
    })();
  };

  const loading = !progress && !progressFailed;

  return (
    <View style={[styles.root, { paddingTop: screenInsets.top, paddingBottom: screenInsets.bottom }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {craftedOpen ? (
          <CraftedContent
            recipeName={recipeName}
            imageKey={displayEntry?.item.imageKey}
            learned={newCount + (summary?.reviewCount ?? 0)}
            durationSec={summary?.durationSec ?? 0}
            streakDays={streakDays}
          />
        ) : (
          <>
            <Overline>오늘의 학습</Overline>
            <Text style={styles.title}>다 했어요</Text>

            {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.body} />
          </View>
        ) : (
          <>
            <Animated.View
              style={{
                opacity: art,
                transform: [
                  { scale: art.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
                ],
              }}
            >
              <Card variant="elevated" style={styles.rewardCard}>
                <View style={styles.rewardTile}>
                  <PlateTile
                    size={88}
                    cornerRadius={radius.tile}
                    image={rewardKey ? ingredientImage(rewardKey) : undefined}
                    imageSize={65}
                  />
                  {/* 보상이 없으면 체크·링·스파크를 아예 렌더하지 않는다.
                      모션 감소 판정 전(null)에도 띄우지 않는다 — 아래 시퀀스와 시작 시점을 맞춘다. */}
                  {rewardKey && reducedMotion !== null && (
                    <RewardBurst runKey={motionKey} instant={plan.instant} />
                  )}
                </View>
                <View style={styles.rewardCopy}>
                  <Overline>{presentation.overline}</Overline>
                  <Text style={styles.rewardName}>{presentation.title}</Text>
                  <Text style={styles.rewardNote}>{presentation.note}</Text>
                </View>
              </Card>
            </Animated.View>

            <Animated.View
              style={[
                styles.recipeBlock,
                {
                  opacity: recipeIn,
                  transform: [
                    { translateY: recipeIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
                  ],
                },
              ]}
            >
              <View style={styles.recipeHead}>
                <Text style={styles.recipeName}>{recipeName}</Text>
                <AnimatedNumber
                  value={ingredientCount}
                  suffix={` / ${INGREDIENTS_PER_ONIGIRI}`}
                  delay={REWARD_TIMELINE.counts.delay}
                  duration={REWARD_TIMELINE.counts.duration}
                  runKey={motionKey}
                  style={styles.recipeCount}
                />
              </View>
              <RewardProgress
                filled={ingredientCount}
                total={INGREDIENTS_PER_ONIGIRI}
                limeFade={limeFade}
                justFilledIndex={plan.justFilledIndex}
              />
              <Text style={styles.recipeCaption}>{remainingCaption(remaining)}</Text>
            </Animated.View>

            <View style={styles.summaryBlock}>
              <SummaryRow
                label="새로 배운 단어"
                value={newCount}
                runKey={motionKey}
                animated
              />
              <SummaryRow label="아직이라고 표시한 단어" value={againCount} />
            </View>

            <Animated.Text style={[styles.memorized, { opacity: noteIn }]}>
              {memorizedNote}
            </Animated.Text>
          </>
            )}
          </>
        )}
      </ScrollView>

      {/* 오버레이가 떠 있는 동안 CTA 는 아예 렌더하지 않는다. */}
      {!receiptOpen && (
        <Animated.View
          style={[
            styles.cta,
            {
              opacity: ctaIn,
              transform: [
                { translateY: ctaIn.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
              ],
            },
          ]}
        >
          {craftedOpen ? (
            <Button label="영수증 받고 마치기" onPress={openReceipt} />
          ) : loading ? (
            <Button label="확인" onPress={() => undefined} disabled />
          ) : (
            <ButtonFillProgress
              label="확인"
              mode="autoAdvance"
              onPress={advanceFromResult}
              frozenProgress={captureMode ? 0.5 : undefined}
            />
          )}
        </Animated.View>
      )}

      {receiptOpen && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* 배경 탭도 버튼과 같은 곳으로 — 하나의 오버레이, 하나의 도착지. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={goHome} accessibilityRole="button" accessibilityLabel="홈으로">
            <Animated.View style={[styles.scrim, { opacity: dim }]} />
          </Pressable>

          <View
            style={[styles.overlayContent, { paddingTop: screenInsets.top, paddingBottom: screenInsets.bottom }]}
            pointerEvents="box-none"
          >
            <Animated.View
              style={[
                styles.paperWrap,
                {
                  transform: [
                    {
                      translateY: print.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-windowHeight, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View ref={receiptRef} collapsable={false}>
                <Receipt
                  dateLabel={dateLabel}
                  rows={receiptRows}
                  recipeName={recipeName}
                  ingredientCount={ingredientCount}
                  ingredientTotal={INGREDIENTS_PER_ONIGIRI}
                  footerNote={memorizedNote}
                  streakLabel={streakDays > 0 ? `${streakDays}일째` : null}
                />
              </View>
            </Animated.View>

            <View style={styles.overlayActions}>
              <View style={styles.overlayRow}>
                <Button
                  label="이미지로 저장"
                  variant="secondary"
                  onPress={onSave}
                  style={styles.overlayBtn}
                />
                <Button label="공유" variant="secondary" onPress={onShare} style={styles.overlayBtn} />
              </View>
              <Pressable style={styles.homeBtn} onPress={goHome} accessibilityRole="button">
                <Text style={styles.homeLabel}>홈으로</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function CraftedContent({
  recipeName,
  imageKey,
  learned,
  durationSec,
  streakDays,
}: {
  recipeName: string;
  imageKey?: OnigiriImageKey;
  learned: number;
  durationSec: number;
  streakDays: number;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.crafted}>
      <Overline style={styles.craftedOverline}>새 메뉴 완성</Overline>
      <Text style={styles.craftedTitle}>새 주먹밥을 만들었어요.</Text>
      {imageKey ? (
        <View style={styles.craftedArt}>
          <PlateTile
            size={176}
            cornerRadius={radius.card}
            image={recipeImage(imageKey)}
            imageSize={148}
          />
          <View style={styles.completeBadge}><Text style={styles.completeBadgeLabel}>완성</Text></View>
        </View>
      ) : null}
      <Text style={styles.craftedName}>{recipeName}</Text>
      <View style={styles.craftedMetrics}>
        <StatTile value={learned} label="학습 단어" />
        <StatTile value={Math.max(1, Math.round(durationSec / 60))} label="학습 시간(분)" />
        <StatTile value={streakDays} label="단골 기록" />
      </View>
      <Text style={styles.ownerLine}>“오늘 것도 잘 만들었네.” · 사장님</Text>
    </View>
  );
}

/**
 * 방금 채워진 칸만 라임에서 시작해 잉크로 가라앉는다 — 라임의 주된 사용처.
 * 나머지 칸은 평범한 진행바다.
 */
function RewardProgress({
  filled,
  total,
  limeFade,
  justFilledIndex,
}: {
  filled: number;
  total: number;
  limeFade: Animated.Value;
  /** 방금 채워진 칸. -1 이면 라임 연출 없이 평범한 진행바로 그린다. */
  justFilledIndex: number;
}): React.ReactNode {
  const { colors } = useTheme();
  const justFilled = justFilledIndex;

  if (justFilled < 0) {
    return <ProgressSegments total={total} filled={filled} height={8} gap={8} fill="ink" />;
  }

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {Array.from({ length: total }, (_, i) => {
        const base = i < filled ? colors.ink : colors.pressed;
        if (i !== justFilled) {
          return (
            <View
              key={i}
              style={{ flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: base }}
            />
          );
        }
        return (
          <Animated.View
            key={i}
            style={{
              flex: 1,
              height: 8,
              borderRadius: radius.pill,
              backgroundColor: limeFade.interpolate({
                // 55% 지점까지 라임을 유지하다 잉크로 넘어간다.
                inputRange: [0, PROGRESS_CELL_LIME_HOLD, 1],
                outputRange: [colors.secondary, colors.secondary, colors.ink],
              }),
            }}
          />
        );
      })}
    </View>
  );
}

function SummaryRow({
  label,
  value,
  animated = false,
  runKey,
}: {
  label: string;
  value: number;
  /** 새로 배운 단어만 카운트업한다. 나머지는 즉시 값으로 둔다. */
  animated?: boolean;
  runKey?: string;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      {animated ? (
        <AnimatedNumber
          value={value}
          delay={REWARD_TIMELINE.counts.delay}
          duration={REWARD_TIMELINE.counts.duration}
          runKey={runKey}
          style={styles.summaryValue}
        />
      ) : (
        <Text style={styles.summaryValue}>{value}</Text>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.softer },
    scroll: { flex: 1 },
    body: {
      flexGrow: 1,
      paddingHorizontal: layout.gutter,
      paddingTop: 32,
      paddingBottom: layout.gutter,
    },
    title: { ...typography.resultTitle, color: c.ink, marginTop: spacing.sm },
    loading: { marginTop: spacing.huge, alignItems: 'center' },

    rewardCard: {
      marginTop: layout.gapGroup,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18,
      paddingVertical: 24,
      paddingHorizontal: layout.gutter,
    },
    rewardTile: { position: 'relative' },
    rewardCopy: { flex: 1, gap: 6 },
    rewardName: { ...typography.meaning, color: c.ink },
    rewardNote: { ...typography.body, color: c.body },

    recipeBlock: { marginTop: layout.gapGroup, gap: layout.gapTight },
    recipeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    recipeName: { ...typography.listTitle, color: c.ink, flexShrink: 1 },
    recipeCount: { ...typography.caption, color: c.body },
    recipeCaption: { ...typography.body, color: c.body },

    summaryBlock: { marginTop: layout.gapGroup },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
      paddingVertical: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: c.pressed,
      marginBottom: -StyleSheet.hairlineWidth,
    },
    summaryLabel: { ...typography.body, color: c.body, flexShrink: 1 },
    summaryValue: { ...typography.cardTitle, color: c.ink, fontVariant: ['tabular-nums'] },

    memorized: { ...typography.body, color: c.body, marginTop: spacing.lg },

    crafted: { flex: 1, alignItems: 'center', gap: spacing.lg },
    craftedOverline: { color: c.primary },
    craftedTitle: { ...typography.resultTitle, color: c.ink, textAlign: 'center' },
    craftedArt: { position: 'relative', marginVertical: spacing.md },
    completeBadge: {
      position: 'absolute',
      right: -8,
      bottom: 8,
      borderRadius: radius.pill,
      backgroundColor: c.secondary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    completeBadgeLabel: { ...typography.captionStrong, color: c.onSecondary },
    craftedName: { ...typography.meaning, color: c.ink, textAlign: 'center' },
    craftedMetrics: { alignSelf: 'stretch', flexDirection: 'row', gap: spacing.sm },
    ownerLine: { ...typography.body, color: c.body, textAlign: 'center' },

    cta: { paddingHorizontal: layout.gutter, paddingTop: layout.gutter, paddingBottom: layout.gapGroup },

    scrim: { flex: 1, backgroundColor: 'rgba(19,19,22,0.82)' },
    overlayContent: { flex: 1, justifyContent: 'space-between' },
    paperWrap: { paddingTop: 56, paddingHorizontal: 26 },
    overlayActions: { paddingHorizontal: 26, paddingTop: layout.gutter, paddingBottom: 34, gap: 10 },
    overlayRow: { flexDirection: 'row', gap: 10 },
    overlayBtn: { flex: 1, minHeight: 52 },
    homeBtn: {
      minHeight: 52,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.28)',
      backgroundColor: 'rgba(255,255,255,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    homeLabel: { fontFamily: font.semibold, fontSize: 16, lineHeight: 20, color: '#FFFFFF' },
  });

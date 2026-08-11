// Design Ref: Onikan — 온보딩 튜토리얼.
// 첫 실행 1회: 준비 → 학습(데모 5카드) → 재료 → 완성 규칙 → 영수증 → /home.
// 데모 카드는 SRS/DB 미기록 — 실제 정책을 미리 보여주는 연습 흐름.
//
// 평가는 실제 학습과 같은 2단계다. 여기서만 3단계를 쓰면 첫 학습에서 다시 배워야 한다.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  layout,
  motion,
  radius,
  spacing,
  typography,
  type ThemeColors,
} from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';
import { Button } from '~/components/ui/Button';
import { Card, Overline, ProgressCells, Tile } from '~/components/ui/Surface';
import { Receipt } from '~/features/onigiri/components';
import { useSettingsStore } from '~/stores/SettingsStore';
import { useReducedMotion } from '~/hooks/useReducedMotion';
import { catImages } from './catAssets';
import { INGREDIENTS_PER_ONIGIRI, TEMP_ONIGIRI_CATALOG } from './catalog';
import { ingredientImage, ingredientName } from './ingredientAssets';
import { recipeImage } from './recipeAssets';
import type { CatPose } from './types';

// 데모 단어 — 튜토리얼 전용 고정 5개 (DB 의존 없음, 미기록).
const DEMO_WORDS = [
  { kanji: '秋', kana: 'あき', mean: '가을' },
  { kanji: '山', kana: 'やま', mean: '산' },
  { kanji: '雨', kana: 'あめ', mean: '비' },
  { kanji: '駅', kana: 'えき', mean: '역' },
  { kanji: '食塩', kana: 'しょくえん', mean: '식염' },
] as const;

const TUTORIAL_ONIGIRI = TEMP_ONIGIRI_CATALOG[0]!;
const TUTORIAL_INGREDIENT = TUTORIAL_ONIGIRI.ingredients[0];
const TUTORIAL_INGREDIENT_COUNT = 1;

type Step = 'setup' | 'study' | 'ingredient' | 'crafting' | 'receipt';
const STEP_ORDER: readonly Step[] = ['setup', 'study', 'ingredient', 'crafting', 'receipt'];

// 모든 포즈를 동일 박스(폭 46% × 높이 24%) 안에 contain — 세로형(calm/show/present)은
// 높이가 맞춰져 균일, 가로형(make)은 폭에 걸려 원래 비율로 떨어짐.
const CAT_BOX_WIDTH_RATIO = 0.46;
const CAT_BOX_HEIGHT_RATIO = 0.24;

function TutorialCat({
  pose,
  screenWidth,
  screenHeight,
}: {
  pose: CatPose;
  screenWidth: number;
  screenHeight: number;
}): React.ReactNode {
  return (
    <Image
      source={catImages[pose]}
      resizeMode="contain"
      style={{
        alignSelf: 'center',
        width: Math.round(screenWidth * CAT_BOX_WIDTH_RATIO),
        height: Math.round(screenHeight * CAT_BOX_HEIGHT_RATIO),
      }}
    />
  );
}

function formatToday(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

export default function TutorialScreen(): React.ReactNode {
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const completeTutorial = useSettingsStore((s) => s.completeTutorial);
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  const [step, setStep] = useState<Step>('setup');
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  // 네이티브 설정을 읽는 동안 콘텐츠를 숨기지 않는다.
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    anim.stopAnimation();
    if (reducedMotion === null) return;
    if (reducedMotion) {
      anim.setValue(1);
      return;
    }

    anim.setValue(0);
    const animation = Animated.timing(anim, {
      toValue: 1,
      duration: motion.durationMs,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [step, cardIndex, anim, reducedMotion]);

  const finish = useCallback(() => {
    completeTutorial();
    router.replace('/home');
  }, [completeTutorial, router]);

  const goBack = useCallback(() => {
    if (step === 'study' && cardIndex > 0) {
      setCardIndex((i) => i - 1);
      setRevealed(false);
      return;
    }
    const idx = STEP_ORDER.indexOf(step);
    const prev = idx > 0 ? STEP_ORDER[idx - 1] : undefined;
    if (!prev) {
      router.back(); // setup → 인트로로 복귀
      return;
    }
    if (prev === 'study') setCardIndex(DEMO_WORDS.length - 1);
    setRevealed(false);
    setStep(prev);
  }, [step, cardIndex, router]);

  const nextCard = useCallback(() => {
    setRevealed(false);
    if (cardIndex < DEMO_WORDS.length - 1) setCardIndex((i) => i + 1);
    else setStep('ingredient');
  }, [cardIndex]);

  const todayLabel = formatToday(Date.now());
  const ingredientLabel = ingredientName(TUTORIAL_INGREDIENT);

  let body: React.ReactNode;
  switch (step) {
    case 'setup':
      body = (
        <>
          <Overline>튜토리얼</Overline>
          <View style={styles.spacer} />
          <TutorialCat pose="show" screenWidth={width} screenHeight={height} />
          <View style={styles.centerBlock}>
            <Text style={styles.title}>먼저 5개만.</Text>
            <Text style={styles.lead}>
              짧게 공부하고, 재료를 얻는 흐름을{'\n'}먼저 연습해 봐요.
            </Text>
          </View>
          <View style={styles.spacer} />
          <Button label="시작" onPress={() => setStep('study')} />
        </>
      );
      break;

    case 'study': {
      const w = DEMO_WORDS[cardIndex] ?? DEMO_WORDS[0];
      body = (
        <>
          <View style={styles.demoTrack}>
            {DEMO_WORDS.map((_, i) => (
              <View
                key={i}
                style={[styles.demoCell, i < cardIndex && styles.demoCellFilled]}
              />
            ))}
          </View>
          <Pressable
            style={styles.demoCard}
            onPress={() => setRevealed(true)}
            accessibilityRole="button"
            accessibilityLabel="탭해서 뜻 확인"
          >
            <Text style={styles.demoWord}>{w.kanji}</Text>
            {revealed && (
              <>
                <Text style={styles.demoReading}>{w.kana}</Text>
                <Text style={styles.demoMeaning}>{w.mean}</Text>
              </>
            )}
            {!revealed && <Text style={styles.demoHint}>탭해서 뜻 확인</Text>}
          </Pressable>
          {revealed ? (
            <View style={styles.demoActions}>
              <Button label="아직이에요" variant="outline" tall style={styles.demoBtn} onPress={nextCard} />
              <Button label="외웠어요" variant="ink" tall style={styles.demoBtn} onPress={nextCard} />
            </View>
          ) : (
            <Button label="뜻 보기" onPress={() => setRevealed(true)} />
          )}
        </>
      );
      break;
    }

    case 'ingredient':
      body = (
        <>
          <Overline>다 했어요</Overline>
          <View style={styles.spacer} />
          <TutorialCat pose="make" screenWidth={width} screenHeight={height} />
          <Card elevated style={styles.rewardCard}>
            <Tile
              size={72}
              cornerRadius={radius.tile}
              image={ingredientImage(TUTORIAL_INGREDIENT)}
              imageSize={56}
            />
            <View style={styles.rewardCopy}>
              <Overline>새 재료</Overline>
              <Text style={styles.rewardName}>{ingredientLabel}</Text>
              <Text style={styles.lead}>학습 1회를 마치면 재료 1개를 받아요.</Text>
            </View>
          </Card>
          <View style={styles.progressBlock}>
            <Text style={styles.recipeName}>{TUTORIAL_ONIGIRI.name}</Text>
            <ProgressCells
              total={INGREDIENTS_PER_ONIGIRI}
              filled={TUTORIAL_INGREDIENT_COUNT}
              height={8}
              gap={8}
              fill="ink"
            />
          </View>
          <View style={styles.spacer} />
          <Button label="계속" onPress={() => setStep('crafting')} />
        </>
      );
      break;

    case 'crafting':
      body = (
        <>
          <Overline>완성 규칙</Overline>
          <View style={styles.spacer} />
          <Tile
            size={140}
            cornerRadius={radius.card}
            image={recipeImage(TUTORIAL_ONIGIRI.imageKey)}
            imageSize={112}
            style={styles.craftTile}
          />
          <View style={styles.centerBlock}>
            <Text style={styles.title}>{TUTORIAL_ONIGIRI.name}</Text>
            <View style={styles.craftProgress}>
              <ProgressCells
                total={INGREDIENTS_PER_ONIGIRI}
                filled={INGREDIENTS_PER_ONIGIRI}
                height={8}
                gap={8}
                fill="ink"
              />
            </View>
            <Text style={styles.lead}>
              재료 {INGREDIENTS_PER_ONIGIRI}개가 모이면 완성돼요.{'\n'}완성한 메뉴는 도감에 쌓여요.
            </Text>
          </View>
          <View style={styles.spacer} />
          <Button label="계속" onPress={() => setStep('receipt')} />
        </>
      );
      break;

    case 'receipt':
      body = (
        <>
          <View style={styles.spacer} />
          <Receipt
            dateLabel={todayLabel}
            rows={[
              { label: '새로 배운 단어', value: DEMO_WORDS.length },
              { label: '아직이라고 표시한 단어', value: 0 },
              { label: '받은 재료', value: ingredientLabel, reward: true },
            ]}
            recipeName={TUTORIAL_ONIGIRI.name}
            ingredientCount={TUTORIAL_INGREDIENT_COUNT}
            ingredientTotal={INGREDIENTS_PER_ONIGIRI}
            footerNote="학습을 마치면 매번 영수증이 나와요."
            streakLabel="연습"
          />
          <Text style={styles.receiptCaption}>
            연습 결과는 저장되지 않아요.{'\n'}실제 학습을 마치면 보상과 기록이 남아요.
          </Text>
          <View style={styles.spacer} />
          <Button label="시작하기" onPress={finish} />
        </>
      );
      break;
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로">
          <Text style={styles.navText}>‹ 뒤로</Text>
        </Pressable>
        {step === 'setup' && (
          <Pressable onPress={finish} hitSlop={12} accessibilityRole="button" accessibilityLabel="건너뛰기">
            <Text style={styles.navText}>건너뛰기</Text>
          </Pressable>
        )}
      </View>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: anim,
            transform: [
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
            ],
          },
        ]}
      >
        {body}
      </Animated.View>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.softer },
    topBar: {
      height: layout.touchTarget,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: layout.gutter,
    },
    navText: { ...typography.body, color: c.body },
    content: {
      flex: 1,
      paddingHorizontal: layout.gutter,
      paddingBottom: spacing.xxl,
    },
    spacer: { flex: 1, minHeight: spacing.lg },
    centerBlock: { alignItems: 'center', marginTop: spacing.lg, gap: layout.gapTight },
    title: { ...typography.resultTitle, color: c.ink, textAlign: 'center' },
    lead: { ...typography.body, color: c.body, textAlign: 'center' },

    demoTrack: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
    demoCell: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: c.pressed },
    demoCellFilled: { backgroundColor: c.ink },
    demoCard: {
      flex: 1,
      marginTop: spacing.lg,
      marginBottom: layout.gutter,
      backgroundColor: c.canvas,
      borderRadius: radius.card,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      padding: 24,
    },
    demoWord: { ...typography.cardWord, color: c.ink, textAlign: 'center' },
    demoReading: { ...typography.reading, color: c.body },
    demoMeaning: { ...typography.meaning, color: c.ink, marginTop: spacing.sm },
    demoHint: { ...typography.body, color: c.body, marginTop: spacing.lg },
    demoActions: { flexDirection: 'row', gap: 10 },
    demoBtn: { flex: 1 },

    rewardCard: {
      marginTop: layout.gutter,
      flexDirection: 'row',
      alignItems: 'center',
      gap: layout.gapTight,
    },
    rewardCopy: { flex: 1, gap: 6 },
    rewardName: { ...typography.meaning, color: c.ink },
    progressBlock: { marginTop: layout.gapGroup, gap: layout.gapTight },
    recipeName: { ...typography.listTitle, color: c.ink },

    craftTile: { alignSelf: 'center' },
    craftProgress: { alignSelf: 'stretch', paddingHorizontal: spacing.huge },

    receiptCaption: {
      ...typography.body,
      color: c.body,
      textAlign: 'center',
      marginTop: spacing.lg,
    },
  });

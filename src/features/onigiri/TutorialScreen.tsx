// Design Ref: ONIGIRI SHOP redesign — Onboarding Tutorial (prototype: onboarding-tutorial.html).
// 첫 실행 1회: Setup → Study(데모 5카드) → Ingredient → Complete → Receipt → /home.
// 데모 카드는 SRS/DB 미기록 — 학습 루프 체험만. 완료/Skip 시 tutorialCompleted 영속.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Animated, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { buttons, colors, fontFamily, motion, spacing, typography } from '~/design/tokens';
import { useSettingsStore } from '~/stores/SettingsStore';
import { catImages } from './catAssets';
import type { CatPose } from './types';
import { IngredientSegments, LabelValueRow, OnigiriSketch, Receipt } from './components';
import { formatOnigiriDate } from './components/OnigiriIndexItem';

// 데모 단어 — 튜토리얼 전용 고정 5개 (DB 의존 없음, 미기록).
const DEMO_WORDS = [
  { kanji: '秋', kana: 'あき', mean: '가을' },
  { kanji: '山', kana: 'やま', mean: '산' },
  { kanji: '雨', kana: 'あめ', mean: '비' },
  { kanji: '駅', kana: 'えき', mean: '역' },
  { kanji: '食塩', kana: 'しょくえん', mean: '식염' },
] as const;

type Step = 'setup' | 'study' | 'ingredient' | 'complete' | 'receipt';
const STEP_ORDER: readonly Step[] = ['setup', 'study', 'ingredient', 'complete', 'receipt'];

// 모든 포즈를 동일 박스(폭 46% × 높이 24%) 안에 contain — 세로형(calm/show/present)은
// 높이가 맞춰져 균일, 가로형(make)은 폭에 걸려 프로토타입 비율(180×153)로 떨어짐.
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

export default function TutorialScreen(): React.ReactNode {
  const router = useRouter();
  const completeTutorial = useSettingsStore((s) => s.completeTutorial);
  const { width, height } = useWindowDimensions();

  const [step, setStep] = useState<Step>('setup');
  const [cardIndex, setCardIndex] = useState(0);
  const [receiptSaved, setReceiptSaved] = useState(false);

  // 프로토타입 .view 진입 트랜지션 (opacity + translateY 8px).
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: motion.durationMs,
      useNativeDriver: true,
    }).start();
  }, [step, cardIndex, anim]);

  const finish = useCallback(() => {
    completeTutorial();
    router.replace('/home');
  }, [completeTutorial, router]);

  const goBack = useCallback(() => {
    if (step === 'study' && cardIndex > 0) {
      setCardIndex((i) => i - 1);
      return;
    }
    const idx = STEP_ORDER.indexOf(step);
    const prev = idx > 0 ? STEP_ORDER[idx - 1] : undefined;
    if (!prev) {
      router.back(); // setup → 인트로로 복귀
      return;
    }
    if (prev === 'study') setCardIndex(DEMO_WORDS.length - 1);
    setStep(prev);
  }, [step, cardIndex, router]);

  const nextCard = useCallback(() => {
    if (cardIndex < DEMO_WORDS.length - 1) setCardIndex((i) => i + 1);
    else setStep('ingredient');
  }, [cardIndex]);

  const todayLabel = formatOnigiriDate(Date.now());

  let body: React.ReactNode;
  switch (step) {
    case 'setup':
      body = (
        <>
          <Text style={styles.labelTop}>TUTORIAL</Text>
          <View style={styles.spacer} />
          <TutorialCat pose="show" screenWidth={width} screenHeight={height} />
          <View style={styles.centerBlock}>
            <Text style={styles.h1}>먼저 5개만.</Text>
            <Text style={styles.bodyMuted}>
              짧게 공부하고, 오니기리 하나를{'\n'}만들어보면 돼.
            </Text>
          </View>
          <View style={styles.spacer} />
          <PrimaryButton label="Start" onPress={() => setStep('study')} />
        </>
      );
      break;

    case 'study': {
      const w = DEMO_WORDS[cardIndex] ?? DEMO_WORDS[0];
      body = (
        <>
          <Text style={styles.progress}>{cardIndex + 1} / {DEMO_WORDS.length}</Text>
          <View style={styles.card}>
            <Text style={styles.kanji}>{w.kanji}</Text>
            <Text style={styles.kana}>{w.kana}</Text>
            <Text style={styles.mean}>{w.mean}</Text>
            {cardIndex === 0 && <Text style={styles.hint}>기억나는 정도를 골라.</Text>}
          </View>
          <View style={styles.answers}>
            <AnswerButton label="모름" onPress={nextCard} />
            <AnswerButton label="헷갈림" onPress={nextCard} />
            <AnswerButton label="암기" primary onPress={nextCard} />
          </View>
        </>
      );
      break;
    }

    case 'ingredient':
      body = (
        <>
          <Text style={[styles.labelTop, styles.centerText]}>COMPLETED</Text>
          <View style={styles.spacer} />
          <TutorialCat pose="make" screenWidth={width} screenHeight={height} />
          <Text style={styles.catLineMuted}>5개를 봤어.</Text>
          <View style={styles.statsBlock}>
            <LabelValueRow label="NEW WORDS" value={5} borderBottom />
            <LabelValueRow label="INGREDIENT" value="SEAWEED" valueSize="small" />
          </View>
          <View style={styles.centerBlock}>
            <Text style={styles.h2}>TUNA MAYO</Text>
            <IngredientSegments count={4} total={4} style={styles.segments} />
          </View>
          <View style={styles.spacer} />
          <PrimaryButton label="Continue" onPress={() => setStep('complete')} />
        </>
      );
      break;

    case 'complete':
      body = (
        <>
          <View style={styles.spacer} />
          <TutorialCat pose="present" screenWidth={width} screenHeight={height} />
          <OnigiriSketch size={120} style={styles.onigiri} />
          <View style={styles.centerBlock}>
            <Text style={styles.h1}>TUNA MAYO</Text>
            <Text style={styles.completedDate}>COMPLETED   {todayLabel}</Text>
            <Text style={styles.catLine}>참치마요가 됐네.</Text>
            <Text style={styles.who}>— 사장</Text>
          </View>
          <View style={styles.spacer} />
          <PrimaryButton label="Continue" onPress={() => setStep('receipt')} />
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
              { label: 'NEW WORDS', value: 5 },
              { label: 'INGREDIENT', value: 'SEAWEED' },
              { label: 'CRAFTED', value: 'TUNA MAYO' },
            ]}
          />
          <Text style={styles.receiptCaption}>공부한 기록은 이렇게 남아.</Text>
          <View style={styles.spacer} />
          <View style={styles.btnColumn}>
            <Pressable
              style={({ pressed }) => [
                styles.btnSecondary,
                pressed && !receiptSaved && styles.btnSecondaryPressed,
              ]}
              disabled={receiptSaved}
              onPress={() => setReceiptSaved(true)}
              accessibilityRole="button"
            >
              <Text style={[styles.btnSecondaryText, receiptSaved && styles.btnTextFaint]}>
                {receiptSaved ? 'Saved' : 'Save Receipt'}
              </Text>
            </Pressable>
            <PrimaryButton label="Continue" onPress={finish} />
          </View>
        </>
      );
      break;
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로">
          <Text style={styles.navBack}>‹ Back</Text>
        </Pressable>
        {step === 'setup' && (
          <Pressable onPress={finish} hitSlop={12} accessibilityRole="button" accessibilityLabel="건너뛰기">
            <Text style={styles.navSkip}>Skip</Text>
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

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }): React.ReactNode {
  return (
    <Pressable
      style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={styles.btnPrimaryText}>{label}</Text>
    </Pressable>
  );
}

function AnswerButton({
  label,
  primary = false,
  onPress,
}: {
  label: string;
  primary?: boolean;
  onPress: () => void;
}): React.ReactNode {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.answerBtn,
        primary ? styles.answerPrimary : styles.answerSecondary,
        pressed && styles.btnPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={[styles.answerText, primary && styles.answerTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  navBack: { ...typography.small, fontSize: 14, color: colors.textSecondary },
  navSkip: { ...typography.small, color: colors.textSecondary, letterSpacing: 0.3 },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  spacer: { flex: 1 },
  centerBlock: { alignItems: 'center', marginTop: spacing.lg },
  centerText: { textAlign: 'center' },

  labelTop: { ...typography.tiny, color: colors.textSecondary, marginTop: spacing.sm },
  h1: { ...typography.h1, color: colors.text, textAlign: 'center' },
  h2: { ...typography.h2, color: colors.text, textAlign: 'center' },
  bodyMuted: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  progress: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginTop: spacing.sm,
  },
  card: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  kanji: { fontSize: 96, lineHeight: 104, color: colors.text, letterSpacing: 2 },
  kana: { fontSize: 20, lineHeight: 26, color: colors.textSecondary },
  mean: { fontSize: 17, lineHeight: 24, color: colors.text, marginTop: 2 },
  hint: { ...typography.small, color: colors.textTertiary, marginTop: spacing.md },
  answers: { flexDirection: 'row', gap: spacing.sm },
  answerBtn: {
    flex: 1,
    borderRadius: buttons.primary.borderRadius,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
  },
  answerPrimary: { backgroundColor: colors.black, borderColor: 'transparent' },
  answerSecondary: { backgroundColor: 'transparent', borderColor: colors.borderStrong },
  answerText: { fontSize: 14, lineHeight: 19, fontWeight: '500', color: colors.text },
  answerTextPrimary: { color: colors.white },

  catLineMuted: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  statsBlock: { marginTop: spacing.lg },
  segments: { justifyContent: 'center', marginTop: spacing.md },

  onigiri: { alignSelf: 'center', marginTop: spacing.sm },
  completedDate: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 10,
  },
  catLine: { ...typography.body, color: colors.text, lineHeight: 28, marginTop: spacing.lg },
  who: { ...typography.small, color: colors.textSecondary, marginTop: 4 },

  receiptCaption: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md + 2,
  },
  btnColumn: { gap: spacing.sm },
  btnPrimary: {
    borderRadius: buttons.primary.borderRadius,
    paddingVertical: buttons.primary.paddingVertical,
    paddingHorizontal: buttons.primary.paddingHorizontal,
    backgroundColor: buttons.primary.backgroundColor,
    alignItems: 'center',
  },
  btnPrimaryText: { fontSize: 15, lineHeight: 20, fontWeight: '500', color: colors.white },
  btnSecondary: {
    borderRadius: buttons.secondary.borderRadius,
    paddingVertical: buttons.secondary.paddingVertical,
    paddingHorizontal: buttons.secondary.paddingHorizontal,
    borderWidth: 1,
    borderColor: buttons.secondary.borderColor,
    alignItems: 'center',
  },
  btnSecondaryPressed: { backgroundColor: colors.surfaceMuted },
  btnSecondaryText: { fontSize: 15, lineHeight: 20, fontWeight: '500', color: colors.text },
  btnTextFaint: { color: colors.textTertiary },
  btnPressed: { opacity: 0.85 },
});

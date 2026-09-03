// Design Ref: Onikan — 온보딩 튜토리얼.
// 첫 실행 1회: 준비 → 학습(데모 5카드) → 재료 → 완성 규칙 → 영수증 → /home.
// 데모 카드는 SRS/DB 미기록 — 실제 정책을 미리 보여주는 연습 흐름.
//
// 평가는 실제 학습과 같은 2단계다. 여기서만 3단계를 쓰면 첫 학습에서 다시 배워야 한다.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
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
import { ButtonFillProgress } from '~/components/ui/ButtonFillProgress';
import { Card, Overline, PlateTile } from '~/components/ui/Surface';
import { StudyCard, type PhoneticHint } from '~/features/study/components/StudyCard';
import { StudyProgressHeader } from '~/features/study/components/StudyProgressHeader';
import { Receipt } from '~/features/onigiri/components';
import { useSettingsStore } from '~/stores/SettingsStore';
import { useReducedMotion } from '~/hooks/useReducedMotion';
import { useTTS } from '~/hooks/useTTS';
import { revealStudyCard } from '~/features/study/studyRevealAudio';
import { catImages } from './catAssets';
import { INGREDIENTS_PER_ONIGIRI, TEMP_ONIGIRI_CATALOG } from './catalog';
import { ingredientImage, ingredientName } from './ingredientAssets';
import { resolveStudyEntry } from '~/features/study/resolveStudyEntry';
import type { CatPose } from './types';
import type { Word } from '~/types/Card';
import { onboardingImages } from './onboardingAssets';
import { OnboardingConfetti } from './components/OnboardingConfetti';

// 데모 단어 — 튜토리얼 전용 고정 10개 (DB 조회 없음, 미기록).
// 온보딩 콘텐츠는 로컬 고정이라 예문·발음 힌트도 여기 함께 둔다.
// id 는 실제 DB word id 를 그대로 박는다. 합성 id(`tutorial-秋`)를 쓰면 번들 오디오 맵이
// 전부 미스라 온보딩 내내 시스템 TTS로 떨어진다 — 첫인상에서 음질이 가장 나쁜 구간이 된다.
// 예문은 여기 직접 쓴 N5 문장이라 DB 예문 오디오와 다르다. 예문 재생은 TTS로 둘 것.
function demoWord(
  id: string,
  surface: string,
  reading: string,
  meaning: string,
  exampleJp: string,
  exampleKo: string,
  phonetic?: PhoneticHint,
): Word & { phonetic?: PhoneticHint } {
  return {
    id,
    level: 'N5',
    surface,
    reading_kana: reading,
    meaning_ko: meaning,
    card_type: 'A',
    example_jp: exampleJp,
    example_ko: exampleKo,
    qa_status: 'verified',
    deprecated: 0,
    data_version: 0,
    phonetic,
  };
}

const DEMO_WORDS = [
  demoWord('w_92cdd1203bd7bf3f', '秋', 'あき', '가을', '秋の空は高いです。', '가을 하늘은 높습니다.'),
  demoWord('w_9200ebb3b9a05823', '山', 'やま', '산', 'あの山に登ります。', '저 산에 오릅니다.'),
  demoWord('w_48fbd408a115f905', '雨', 'あめ', '비', '今日は雨が降ります。', '오늘은 비가 옵니다.'),
  demoWord('w_1a590a2722d8602f', '駅', 'えき', '역', '駅の前で会いましょう。', '역 앞에서 만납시다.'),
  demoWord('w_45ad1afbb9ff44ff', '食塩', 'しょくえん', '식염', '食塩を少し入れます。', '식염을 조금 넣습니다.', {
    left: 'しょくえん',
    right: '식염',
  }),
  demoWord('w_f238004dca80f8bb', '空', 'そら', '하늘', '空が青いです。', '하늘이 파랗습니다.'),
  demoWord('w_3c328157edaee908', '花', 'はな', '꽃', '庭に花が咲きました。', '정원에 꽃이 피었습니다.'),
  demoWord('w_af5024e6326a3ea3', '本', 'ほん', '책', '本を三冊買いました。', '책을 세 권 샀습니다.'),
  demoWord('w_053f7db9e9a81e55', '友達', 'ともだち', '친구', '友達と映画を見ます。', '친구와 영화를 봅니다.'),
  demoWord('w_78a37817bd6740bc', '時間', 'じかん', '시간', '時間がありません。', '시간이 없습니다.', {
    left: 'じかん',
    right: '시간',
  }),
] as const;

const TUTORIAL_ONIGIRI = TEMP_ONIGIRI_CATALOG[0]!;
const TUTORIAL_INGREDIENT = TUTORIAL_ONIGIRI.ingredients[0];
const TUTORIAL_INGREDIENT_COUNT = 1;
const REMAINING_INGREDIENT_NOTE = `완성까지 재료 ${INGREDIENTS_PER_ONIGIRI - TUTORIAL_INGREDIENT_COUNT}개가 남았어.`;

type Step = 'setup' | 'study' | 'ingredient' | 'receipt' | 'finish';
const STEP_ORDER: readonly Step[] = ['setup', 'study', 'ingredient', 'receipt', 'finish'];

// 모든 포즈를 동일 박스(폭 46% × 높이 24%) 안에 contain — 세로형(calm/show/present)은
// 높이가 맞춰져 균일, 가로형(make)은 폭에 걸려 원래 비율로 떨어짐.
const CAT_BOX_WIDTH_RATIO = 0.46;
const CAT_BOX_HEIGHT_RATIO = 0.24;

function TutorialCat({
  pose,
  screenWidth,
  screenHeight,
  source,
}: {
  pose: CatPose;
  screenWidth: number;
  screenHeight: number;
  source?: ImageSourcePropType;
}): React.ReactNode {
  return (
    <Image
      source={source ?? catImages[pose]}
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
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
}

function TutorialReceipt({
  dateLabel,
  ingredientLabel,
  againCount,
  reducedMotion,
  onConfirm,
}: {
  dateLabel: string;
  ingredientLabel: string;
  againCount: number;
  reducedMotion: boolean | null;
  onConfirm: () => void;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const { height } = useWindowDimensions();
  const print = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    print.stopAnimation();
    if (reducedMotion !== false) {
      print.setValue(1);
      return;
    }

    print.setValue(0);
    const animation = Animated.timing(print, {
      toValue: 1,
      delay: motion.receiptPrintDelayMs,
      duration: motion.receiptPrintMs,
      easing: Easing.bezier(0.5, 0, 0.25, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [print, reducedMotion]);

  return (
    <View style={styles.receiptScene}>
      <Text style={styles.receiptTitle}>영수증을 받으세요</Text>
      <View style={styles.receiptClip}>
        <Animated.View
          style={{
            transform: [
              {
                translateY: print.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-Math.round(height * 0.62), 0],
                }),
              },
            ],
          }}
        >
          <Receipt
            dateLabel={dateLabel}
            rows={[
              { label: '새로 배운 단어', value: DEMO_WORDS.length - againCount },
              { label: '다시 배울 단어', value: againCount },
              { label: '받은 재료', value: ingredientLabel, reward: true },
            ]}
            recipeName={TUTORIAL_ONIGIRI.name}
            ingredientCount={TUTORIAL_INGREDIENT_COUNT}
            ingredientTotal={INGREDIENTS_PER_ONIGIRI}
            recipeNote={REMAINING_INGREDIENT_NOTE}
            streakLabel="연습"
          />
        </Animated.View>
      </View>
      <Text style={styles.receiptCaption}>
        연습 중이라 결과는 저장되지 않아요.{`\n`}실제 학습 후 보상과 기록이 남아요.
      </Text>
      <View style={styles.spacer} />
      <Button label="확인했어" variant="secondary" onPress={onConfirm} />
    </View>
  );
}

export default function TutorialScreen(): React.ReactNode {
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const completeTutorial = useSettingsStore((s) => s.completeTutorial);
  const selectedLevels = useSettingsStore((s) => s.selectedLevels);
  const dailyNewLimit = useSettingsStore((s) => s.dailyNewLimit);
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const tts = useTTS();

  const [step, setStep] = useState<Step>('setup');
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [againCount, setAgainCount] = useState(0);

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

  const finishLater = useCallback(() => {
    completeTutorial();
    router.replace('/home');
  }, [completeTutorial, router]);

  const finishAndStudy = useCallback(() => {
    completeTutorial();
    void resolveStudyEntry(selectedLevels, dailyNewLimit)
      .then((route) => router.replace(route))
      .catch(() => router.replace('/home'));
  }, [completeTutorial, dailyNewLimit, router, selectedLevels]);

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
    if (prev === 'setup') setAgainCount(0);
    setRevealed(false);
    setStep(prev);
  }, [step, cardIndex, router]);

  const revealCard = useCallback(() => {
    const word = DEMO_WORDS[cardIndex] ?? DEMO_WORDS[0]!;
    const settings = useSettingsStore.getState();
    revealStudyCard({
      alreadyRevealed: revealed,
      ttsEnabled: settings.ttsEnabled,
      autoPlayWordTts: settings.autoPlayWordTtsOnReveal,
      onReveal: () => setRevealed(true),
      onSpeakWord: () => tts.speakAudio('word', word.id, word.reading_kana),
    });
  }, [cardIndex, revealed, tts]);

  const nextCard = useCallback((again: boolean) => {
    setRevealed(false);
    if (again) setAgainCount((n) => n + 1);
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
          <View style={styles.spacer} />
          <TutorialCat
            pose="show"
            screenWidth={width}
            screenHeight={height}
            source={onboardingImages.guide}
          />
          <View style={styles.centerBlock}>
            <Text style={styles.title}>먼저 10개만.</Text>
            <Text style={styles.lead}>
              짧게 공부하고, 재료를 얻는{'\n'}흐름을 먼저 연습해보자.
            </Text>
          </View>
          <View style={styles.spacer} />
          <ButtonFillProgress label="계속" mode="guide" onPress={() => setStep('study')} />
        </>
      );
      break;

    case 'study': {
      const w = DEMO_WORDS[cardIndex] ?? DEMO_WORDS[0]!;
      body = (
        <>
          <StudyProgressHeader
            done={cardIndex}
            total={DEMO_WORDS.length}
            onClose={finishLater}
            closeLabel="연습 종료"
          />
          <StudyCard
            word={w}
            revealed={revealed}
            onReveal={revealCard}
            onSpeak={tts.enabled ? () => tts.speakAudio('word', w.id, w.reading_kana) : undefined}
            onSpeakExample={
              tts.enabled && w.example_jp
                ? () => tts.speak(w.example_jp)
                : undefined
            }
            phoneticHint={w.phonetic}
          />
          <View style={styles.studyFooter}>
            {revealed ? (
              <View style={styles.demoActions}>
                <Button
                  label="아직이에요"
                  variant="outline"
                  tall
                  style={styles.demoBtn}
                  onPress={() => nextCard(true)}
                />
                <Button
                  label="외웠어요"
                  variant="ink"
                  tall
                  style={styles.demoBtn}
                  onPress={() => nextCard(false)}
                />
              </View>
            ) : (
              <Button label="뜻 보기" onPress={revealCard} />
            )}
          </View>
        </>
      );
      break;
    }

    case 'ingredient':
      body = (
        <>
          <View style={styles.centerBlock}>
            <Text style={styles.title}>학습 완료!</Text>
            <Text style={styles.lead}>학습 1회를 마치면 재료 1개를 받아요.</Text>
          </View>
          <Card variant="elevated" style={styles.rewardCard}>
            <PlateTile
              size={72}
              cornerRadius={radius.tile}
              image={ingredientImage(TUTORIAL_INGREDIENT)}
              imageSize={56}
            />
            <View style={styles.rewardCopy}>
              <Overline>새 재료</Overline>
              <Text style={styles.rewardName}>{ingredientLabel}</Text>
              <Text style={styles.lead}>{TUTORIAL_ONIGIRI.description}</Text>
            </View>
          </Card>
          <View style={styles.spacer} />
          <View style={styles.pendingCard}>
            <PlateTile size={40} locked cornerRadius={radius.tileSm} />
            <View style={styles.rewardCopy}>
              <Text style={styles.recipeName}>{TUTORIAL_ONIGIRI.name} 주먹밥</Text>
              <Text style={styles.lead}>{REMAINING_INGREDIENT_NOTE}</Text>
            </View>
          </View>
          <ButtonFillProgress
            label="계속"
            mode="studyComplete"
            onPress={() => setStep('receipt')}
          />
        </>
      );
      break;

    case 'receipt':
      body = (
        <TutorialReceipt
          dateLabel={todayLabel}
          ingredientLabel={ingredientLabel}
          againCount={againCount}
          reducedMotion={reducedMotion}
          onConfirm={() => setStep('finish')}
        />
      );
      break;

    case 'finish':
      body = (
        <>
          <View style={styles.spacer} />
          <TutorialCat
            pose="present"
            screenWidth={width}
            screenHeight={height}
            source={onboardingImages.finish}
          />
          <View style={styles.centerBlock}>
            <Text style={styles.title}>그럼 이제 시작해볼까.</Text>
            <Text style={styles.lead}>오늘의 학습을 시작해요.</Text>
          </View>
          <View style={styles.spacer} />
          <Button label="오늘 학습 시작" onPress={finishAndStudy} />
          <Pressable
            onPress={finishLater}
            style={styles.laterLink}
            accessibilityRole="button"
            accessibilityLabel="나중에"
          >
            <Text style={styles.laterLabel}>나중에</Text>
          </Pressable>
        </>
      );
      break;
  }

  return (
    <SafeAreaView
      style={[styles.root, step === 'receipt' && styles.receiptRoot]}
      edges={['top', 'bottom']}
    >
      {step === 'ingredient' ? <OnboardingConfetti runKey="tutorial-ingredient" /> : null}
      <View
        style={[
          styles.topBar,
          (step === 'receipt' || step === 'study') && styles.topBarHidden,
        ]}
      >
        <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로">
          <Text style={styles.navText}>‹ 뒤로</Text>
        </Pressable>
        {step === 'setup' && (
          <Pressable onPress={finishLater} hitSlop={12} accessibilityRole="button" accessibilityLabel="나중에">
            <Text style={styles.navText}>건너뛰기</Text>
          </Pressable>
        )}
      </View>
      <Animated.View
        style={[
          styles.content,
          step === 'study' && styles.studyContent,
          step === 'receipt'
            ? styles.receiptContent
            : {
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
    receiptRoot: { backgroundColor: '#4A4A4D' },
    topBar: {
      height: layout.touchTarget,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: layout.gutter,
    },
    navText: { ...typography.body, color: c.body },
    topBarHidden: { display: 'none' },
    content: {
      flex: 1,
      paddingHorizontal: layout.gutter,
      paddingBottom: spacing.xxl,
    },
    receiptContent: { paddingTop: spacing.xl },
    spacer: { flex: 1, minHeight: spacing.lg },
    centerBlock: { alignItems: 'center', marginTop: spacing.lg, gap: layout.gapTight },
    title: { ...typography.resultTitle, color: c.ink, textAlign: 'center' },
    lead: { ...typography.body, color: c.body, textAlign: 'center' },

    studyContent: { paddingHorizontal: 0 },
    studyFooter: { paddingHorizontal: layout.gutter, paddingTop: layout.gutter },
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
    pendingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: c.canvas,
      borderRadius: radius.tileSm,
      padding: spacing.lg,
      marginBottom: layout.gutter,
    },
    recipeName: { ...typography.cardTitle, color: c.ink },

    receiptCaption: {
      ...typography.body,
      color: c.onInk,
      textAlign: 'center',
      marginTop: spacing.lg,
    },
    receiptScene: { flex: 1 },
    receiptTitle: {
      ...typography.meaning,
      color: c.onInk,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    receiptClip: { overflow: 'hidden' },
    laterLink: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.sm,
    },
    laterLabel: { ...typography.bodyStrong, color: c.body },
  });

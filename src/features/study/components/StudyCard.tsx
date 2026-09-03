// Design Ref: Onikan handoff 화면 2 (`1b`) — 학습 카드.
//
// 앞→뒤 전환은 뒤집기가 아니다. 앞면에서는 단어·발음을 카드 중앙에 두고,
// 공개하면 둘을 위로 이동시키면서 아래에 뜻·예문을 이어 붙인다.
//
// 확정 디자인 1b에 따라 앞면에서 표제어·읽기·TTS를 함께 보여준다.
// 뜻과 예문만 공개 동작 뒤에 이어 붙인다.

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  cardShadow,
  font,
  layout,
  motion,
  radius,
  spacing,
  typography,
  type ThemeColors,
} from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import { IconSpeaker } from '~/design/icons';
import { renderKanjiFace } from '~/lib/cardType';
import { useReducedMotion } from '~/hooks/useReducedMotion';
import type { Word } from '~/types/Card';
import { getCenteredPromptOffset } from '../studyCardMotion';

const REVEALED_PROMPT_TOP = spacing.huge * 3;

/** 음독이 실제로 유사한 카드에만 붙는다 — 항상 노출이 아니다. */
export interface PhoneticHint {
  left: string;
  right: string;
}

interface Props {
  word: Word;
  revealed: boolean;
  onReveal: () => void;
  onSpeak?: () => void;
  onSpeakExample?: () => void;
  onOpenDetail?: () => void;
  phoneticHint?: PhoneticHint;
}

export function StudyCard({
  word,
  revealed,
  onReveal,
  onSpeak,
  onSpeakExample,
  onOpenDetail,
  phoneticHint,
}: Props): React.ReactNode {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const reducedMotion = useReducedMotion();
  const [viewportHeight, setViewportHeight] = useState(0);
  const [promptHeight, setPromptHeight] = useState(0);
  const revealProgress = useRef(new Animated.Value(revealed ? 1 : 0)).current;
  const centeredOffset = getCenteredPromptOffset(
    viewportHeight,
    promptHeight,
    REVEALED_PROMPT_TOP,
  );

  useEffect(() => {
    revealProgress.stopAnimation();
    if (!revealed) {
      revealProgress.setValue(0);
      return;
    }
    if (reducedMotion !== false) {
      revealProgress.setValue(1);
      return;
    }

    const animation = Animated.timing(revealProgress, {
      toValue: 1,
      duration: motion.riseInMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, revealProgress, revealed]);

  return (
    <Pressable
      style={[styles.card, cardShadow(colors)]}
      onPress={revealed ? undefined : onReveal}
      accessibilityRole={revealed ? undefined : 'button'}
      accessibilityLabel={revealed ? undefined : '탭해서 뜻 확인'}
    >
      <ScrollView
        style={styles.scroll}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
        contentContainerStyle={[styles.scrollBody, revealed && styles.revealedScrollBody]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        // 공개 전에는 스크롤이 카드 탭을 삼키지 않도록 잠근다.
        scrollEnabled={revealed}
      >
        <Animated.View
          onLayout={(event) => setPromptHeight(event.nativeEvent.layout.height)}
          style={[
            styles.prompt,
            {
              transform: [
                {
                  translateY: revealProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [centeredOffset, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.word}>{renderKanjiFace(word)}</Text>

          {!!word.reading_kana && (
            <View style={styles.readingRow}>
              <Text style={styles.reading}>{word.reading_kana}</Text>
              {onSpeak && (
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    onSpeak();
                  }}
                  hitSlop={8}
                  style={styles.speakBtn}
                  accessibilityRole="button"
                  accessibilityLabel="발음 듣기"
                >
                  <IconSpeaker size={20} color={colors.ink} />
                </Pressable>
              )}
            </View>
          )}
        </Animated.View>

        {revealed ? (
          <Animated.View
            style={[
              styles.revealBlock,
              {
                opacity: revealProgress.interpolate({
                  inputRange: [0, 0.4, 1],
                  outputRange: [0, 0, 1],
                }),
                transform: [
                  {
                    translateY: revealProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.meaning}>{word.meaning_ko}</Text>

            {phoneticHint && (
              <View style={styles.phonetic}>
                <View style={styles.phoneticPill}>
                  <Text style={styles.phoneticPillLabel}>발음이 유사한 단어</Text>
                </View>
                <View style={styles.phoneticRow}>
                  <Text style={styles.phoneticWord}>{phoneticHint.left}</Text>
                  <View style={styles.phoneticDivider} />
                  <Text style={styles.phoneticWord}>{phoneticHint.right}</Text>
                </View>
              </View>
            )}

            {word.example_jp && (
              <Pressable
                style={styles.example}
                onPress={onSpeakExample}
                disabled={!onSpeakExample}
                accessibilityRole={onSpeakExample ? 'button' : undefined}
                accessibilityLabel={onSpeakExample ? '예문 발음 듣기' : undefined}
              >
                <View style={styles.exampleLead}>
                  <IconSpeaker size={14} color={colors.body} />
                  <Text style={styles.exampleLeadLabel}>예문을 들어보세요</Text>
                </View>
                <Text style={styles.exampleJp}>{word.example_jp}</Text>
                {word.example_ko && <Text style={styles.exampleKo}>{word.example_ko}</Text>}
              </Pressable>
            )}

            {onOpenDetail && (
              <Pressable
                onPress={onOpenDetail}
                style={styles.detailBtn}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="단어 상세 보기"
              >
                <Text style={styles.detailLabel}>단어 상세 ›</Text>
              </Pressable>
            )}
          </Animated.View>
        ) : (
          <View style={styles.hint}>
            <View style={styles.hintDot} />
            <Text style={styles.hintLabel}>탭해서 뜻 확인</Text>
          </View>
        )}
      </ScrollView>
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      flex: 1,
      // 부모의 남은 높이 안에서 반드시 축소되어야 긴 예문이 내부 스크롤을 사용한다.
      // RN Android의 기본 min-height 동작을 그대로 두면 카드가 액션바를 밀어낸다.
      minHeight: 0,
      backgroundColor: c.canvas,
      borderRadius: radius.card,
      marginHorizontal: layout.gutter,
      marginTop: spacing.lg,
      paddingTop: layout.gapTight,
    },
    scroll: { flex: 1, minHeight: 0, alignSelf: 'stretch' },
    scrollBody: {
      flexGrow: 1,
      alignItems: 'center',
      // 긴 카드에서도 표제어가 상단에 붙지 않도록 시선 중심 쪽으로 내린다.
      // 공개 후에도 같은 위치를 유지하고, 긴 뜻·예문은 기존 ScrollView가 처리한다.
      paddingTop: REVEALED_PROMPT_TOP,
      paddingHorizontal: 24,
      paddingBottom: 24,
    },
    // 공개 상태는 유사 발음/예문이 추가되어도 전체 그룹을 기준으로 중앙 정렬한다.
    // 콘텐츠가 viewport보다 길어지면 ScrollView가 자연스럽게 상단부터 스크롤한다.
    revealedScrollBody: {
      justifyContent: 'center',
      paddingTop: 24,
      paddingBottom: 32,
    },
    prompt: { alignItems: 'center' },
    word: { ...typography.cardWord, color: c.ink, textAlign: 'center' },
    readingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 10,
    },
    reading: { ...typography.reading, color: c.body },
    speakBtn: {
      width: layout.touchTarget,
      height: layout.touchTarget,
      borderRadius: radius.pill,
      backgroundColor: c.soft,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // 공개 전 하단 힌트 — 카드 아래쪽에 붙는다.
    hint: { marginTop: 'auto', alignItems: 'center', gap: 10, paddingTop: spacing.huge },
    hintDot: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: c.pressed,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hintLabel: { ...typography.body, color: c.body },

    revealBlock: { alignSelf: 'stretch', alignItems: 'center', marginTop: 32 },
    meaning: { ...typography.meaning, color: c.ink, textAlign: 'center' },

    // 발음 유사 카드는 뉴트럴(D-1) — 라임은 보상 전용이라 여기 쓰지 않는다.
    phonetic: {
      alignSelf: 'stretch',
      marginTop: layout.gutter,
      backgroundColor: c.soft,
      borderRadius: radius.tile,
      paddingVertical: spacing.lg,
      paddingHorizontal: 18,
      alignItems: 'center',
      gap: spacing.md,
    },
    phoneticPill: {
      backgroundColor: c.canvas,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 3,
    },
    phoneticPillLabel: { fontFamily: font.medium, fontSize: 11, lineHeight: 16, color: c.body },
    phoneticRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center' },
    phoneticWord: { ...typography.reading, color: c.ink, flex: 1, textAlign: 'center' },
    phoneticDivider: { width: 1, height: 20, backgroundColor: c.pressed },

    example: {
      alignSelf: 'stretch',
      marginTop: layout.gutter,
      backgroundColor: c.canvas,
      borderWidth: 1,
      borderColor: c.pressed,
      borderRadius: radius.tile,
      paddingVertical: spacing.lg,
      paddingHorizontal: 18,
      alignItems: 'center',
      gap: spacing.sm,
    },
    exampleLead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    exampleLeadLabel: { fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: c.body },
    exampleJp: { ...typography.example, color: c.ink, textAlign: 'center' },
    exampleKo: {
      fontFamily: font.regular,
      fontSize: 14,
      lineHeight: 20,
      color: c.body,
      textAlign: 'center',
    },
    detailBtn: {
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: c.pressed,
      borderRadius: radius.pill,
    },
    detailLabel: { fontFamily: font.semibold, fontSize: 13, lineHeight: 18, color: c.body },
  });

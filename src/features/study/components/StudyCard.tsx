// Design Ref: Onikan handoff 화면 2 (`1b`) — 학습 카드.
//
// 앞→뒤 전환은 뒤집기가 아니라 **이어붙이기**다. 단어·발음이 자리를 지킨 채 아래로
// 뜻·예문이 붙는다 — 방금 본 단어를 잃지 않게.
//
// 확정 디자인 1b에 따라 앞면에서 표제어·읽기·TTS를 함께 보여준다.
// 뜻과 예문만 공개 동작 뒤에 이어 붙인다.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  cardShadow,
  font,
  layout,
  radius,
  spacing,
  typography,
  type ThemeColors,
} from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import { IconSpeaker } from '~/design/icons';
import { renderKanjiFace } from '~/lib/cardType';
import type { Word } from '~/types/Card';

interface Props {
  word: Word;
  revealed: boolean;
  onReveal: () => void;
  onSpeak?: () => void;
  onSpeakExample?: () => void;
  onOpenDetail?: () => void;
}

export function StudyCard({
  word,
  revealed,
  onReveal,
  onSpeak,
  onSpeakExample,
  onOpenDetail,
}: Props): React.ReactNode {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      style={[styles.card, cardShadow(colors)]}
      onPress={revealed ? undefined : onReveal}
      accessibilityRole={revealed ? undefined : 'button'}
      accessibilityLabel={revealed ? undefined : '탭해서 뜻 확인'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
        // 공개 전에는 스크롤이 카드 탭을 삼키지 않도록 잠근다.
        scrollEnabled={revealed}
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

        {revealed ? (
          <View style={styles.revealBlock}>
            <Text style={styles.meaning}>{word.meaning_ko}</Text>

            {word.example_jp && (
              <Pressable
                style={styles.example}
                onPress={onSpeakExample}
                disabled={!onSpeakExample}
                accessibilityRole={onSpeakExample ? 'button' : undefined}
                accessibilityLabel={onSpeakExample ? '예문 발음 듣기' : undefined}
              >
                <Text style={styles.exampleJp}>{word.example_jp}</Text>
                {word.example_ko && <Text style={styles.exampleKo}>{word.example_ko}</Text>}
              </Pressable>
            )}

            {onOpenDetail && (
              <Pressable
                onPress={onOpenDetail}
                style={styles.detailBtn}
                accessibilityRole="button"
                accessibilityLabel="단어 상세 보기"
              >
                <Text style={styles.detailLabel}>단어 상세 ›</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.hint}>
            <View style={styles.hintDot}>
              <Text style={styles.hintMark}>?</Text>
            </View>
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
      backgroundColor: c.canvas,
      borderRadius: radius.card,
      marginHorizontal: layout.gutter,
      marginTop: spacing.lg,
      paddingTop: layout.gapTight,
    },
    scrollBody: {
      flexGrow: 1,
      alignItems: 'center',
      // 긴 카드에서도 표제어가 상단에 붙지 않도록 시선 중심 쪽으로 내린다.
      // 공개 후에도 같은 위치를 유지하고, 긴 뜻·예문은 기존 ScrollView가 처리한다.
      paddingTop: spacing.huge * 3,
      paddingHorizontal: 24,
      paddingBottom: 24,
    },
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
    hintMark: { ...typography.bodyStrong, color: c.body },
    hintLabel: { ...typography.body, color: c.body },

    revealBlock: { alignSelf: 'stretch', alignItems: 'center', marginTop: 32 },
    meaning: { ...typography.meaning, color: c.ink, textAlign: 'center' },
    example: {
      alignSelf: 'stretch',
      marginTop: layout.gutter,
      backgroundColor: c.soft,
      borderRadius: radius.tile,
      paddingVertical: spacing.lg,
      paddingHorizontal: 18,
      gap: spacing.sm,
    },
    exampleJp: { ...typography.example, color: c.ink },
    exampleKo: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: c.body },
    detailBtn: {
      minHeight: layout.touchTarget,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    detailLabel: { fontFamily: font.semibold, fontSize: 14, lineHeight: 18, color: c.body },
  });

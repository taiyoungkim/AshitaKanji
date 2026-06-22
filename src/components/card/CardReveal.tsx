// Design Ref: §5.2 Card UX — reveal 후 (kana/뜻/예문/attribution/TTS)
// presentational: 데이터 표시만. TTS 실행은 onSpeak 콜백 (module-10 useTTS 주입).

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontWeight, radius, spacing, typography } from '~/design/tokens';
import type { Word } from '~/types/Card';
import { renderKanjiFace } from '~/lib/cardType';

interface Props {
  word: Word;
  onSpeak?: () => void;
  onSpeakExample?: () => void;
  onOpenDetail?: () => void;
}

function attributionLine(word: Word): string | null {
  // 외부 사전(NAVER 등) 예문은 출처·라벨 비표시. 자체 제작 예문만 표기.
  if (!word.example_jp) return null;
  return word.example_license === 'self' ? '자체 제작' : null;
}

export function CardReveal({ word, onSpeak, onSpeakExample, onOpenDetail }: Props): React.ReactNode {
  const attribution = attributionLine(word);
  return (
    <View style={styles.container}>
      {/* 표기·읽기 탭 → 발음 재생 (🔊 버튼과 동일 동작) */}
      <Pressable
        style={styles.speakable}
        onPress={onSpeak}
        accessibilityRole="button"
        accessibilityLabel="발음 듣기"
      >
        <Text style={styles.surface}>{renderKanjiFace(word)}</Text>
        <Text style={styles.reading}>{word.reading_kana}</Text>
      </Pressable>
      <Text style={styles.meaning}>{word.meaning_ko}</Text>

      {word.example_jp && (
        <View style={styles.exampleBox}>
          <Text
            style={styles.exampleJp}
            onPress={onSpeakExample}
            accessibilityRole="button"
            accessibilityLabel="예문 발음 듣기"
          >
            {word.example_jp}
          </Text>
          {word.example_ko && <Text style={styles.exampleKo}>{word.example_ko}</Text>}
          {attribution && <Text style={styles.attribution}>{attribution}</Text>}
        </View>
      )}

      <Pressable style={styles.ttsButton} onPress={onSpeak} accessibilityLabel="발음 듣기">
        <Text style={styles.ttsIcon}>🔊</Text>
      </Pressable>
      {onOpenDetail && (
        <Pressable
          style={styles.detailButton}
          onPress={onOpenDetail}
          accessibilityRole="button"
          accessibilityLabel="단어 상세 보기"
        >
          <Text style={styles.detailButtonText}>단어 상세</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  speakable: { alignItems: 'center' },
  surface: {
    fontSize: 48,
    lineHeight: 54,
    fontWeight: fontWeight.medium,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -1,
  },
  reading: { fontSize: 22, lineHeight: 28, color: colors.textSecondary, marginTop: spacing.sm },
  meaning: {
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
    marginTop: spacing.md,
    fontWeight: fontWeight.medium,
  },
  exampleBox: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  exampleJp: { ...typography.body, color: colors.text, textAlign: 'center' },
  exampleKo: { ...typography.small, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  attribution: { ...typography.tiny, color: colors.textTertiary, marginTop: spacing.sm, textTransform: 'none', letterSpacing: 0 },
  ttsButton: { marginTop: spacing.lg, padding: spacing.sm },
  ttsIcon: { fontSize: 28 },
  detailButton: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  detailButtonText: { ...typography.small, color: colors.text, fontWeight: fontWeight.medium },
});

// Design Ref: §5.2 Card UX — 앞면 (한자 면)
// presentational: surface + 타입 배지 + 회상 안내. reveal 트리거는 부모 콜백.

import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fontWeight, spacing, typography } from '~/design/tokens';
import type { Word } from '~/types/Card';
import { frontPromptKo, renderKanjiFace } from '~/lib/cardType';

interface Props {
  word: Word;
  onReveal: () => void;
}

export function CardFace({ word, onReveal }: Props): React.ReactNode {
  return (
    <Pressable style={styles.container} onPress={onReveal} accessibilityRole="button">
      <Text style={styles.surface}>{renderKanjiFace(word)}</Text>
      <Text style={styles.prompt}>{frontPromptKo(word)}</Text>
      <Text style={styles.tapHint}>탭하여 보기</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  surface: {
    fontSize: 56,
    lineHeight: 64,
    fontWeight: fontWeight.medium,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -1,
  },
  prompt: { ...typography.small, color: colors.textSecondary, marginTop: spacing.lg },
  tapHint: { ...typography.small, color: colors.textTertiary, marginTop: spacing.sm },
});

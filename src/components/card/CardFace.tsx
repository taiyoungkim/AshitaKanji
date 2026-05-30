// Design Ref: §5.2 Card UX — 앞면 (한자 면)
// presentational: surface + 타입 배지 + 회상 안내. reveal 트리거는 부모 콜백.

import { Pressable, StyleSheet, Text } from 'react-native';
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
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  surface: { fontSize: 56, fontWeight: '700', color: '#1a1a1a', textAlign: 'center' },
  prompt: { fontSize: 14, color: '#888', marginTop: 24 },
  tapHint: { fontSize: 13, color: '#0366d6', marginTop: 8 },
});

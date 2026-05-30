// Design Ref: §5.2/§5.3 — Card 컨테이너. face↔reveal 토글 (controlled via props).
// 순수 presentational: revealed 상태는 부모(SessionStore, module-7)가 소유.
// 5종 타입 분기는 cardType util이 처리 → Card는 타입 무관 동일 레이아웃.

import { StyleSheet, View } from 'react-native';
import type { Word } from '~/types/Card';
import { CardFace } from './CardFace';
import { CardReveal } from './CardReveal';

interface Props {
  word: Word;
  revealed: boolean;
  onReveal: () => void;
  onSpeak?: () => void;
}

export function Card({ word, revealed, onReveal, onSpeak }: Props): React.ReactNode {
  return (
    <View style={styles.card}>
      {revealed ? (
        <CardReveal word={word} onSpeak={onSpeak} />
      ) : (
        <CardFace word={word} onReveal={onReveal} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
});

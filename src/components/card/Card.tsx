// Design Ref: §5.2/§5.3 — Card 컨테이너. face↔reveal 토글 (controlled via props).
// 순수 presentational: revealed 상태는 부모(SessionStore, module-7)가 소유.
// 5종 타입 분기는 cardType util이 처리 → Card는 타입 무관 동일 레이아웃.

import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '~/design/tokens';
import type { Word } from '~/types/Card';
import { CardFace } from './CardFace';
import { CardReveal } from './CardReveal';

interface Props {
  word: Word;
  revealed: boolean;
  onReveal: () => void;
  onSpeak?: () => void;
  onSpeakExample?: () => void;
  onOpenDetail?: () => void;
}

export function Card({
  word,
  revealed,
  onReveal,
  onSpeak,
  onSpeakExample,
  onOpenDetail,
}: Props): React.ReactNode {
  return (
    <View style={styles.card}>
      {revealed ? (
        <CardReveal word={word} onSpeak={onSpeak} onSpeakExample={onSpeakExample} onOpenDetail={onOpenDetail} />
      ) : (
        <CardFace word={word} onReveal={onReveal} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    margin: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

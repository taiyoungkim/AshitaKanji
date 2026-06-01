// Design Ref: §5.2 reveal UX — 한자 면에서 읽기/뜻 공개 버튼.
// reveal 전에는 이 버튼만, reveal 후에는 GradeButtons 노출.

import { Pressable, StyleSheet, Text } from 'react-native';
import { buttons, colors, fontWeight, spacing } from '~/design/tokens';

interface Props {
  onPress: () => void;
}

export function RevealButton({ onPress }: Props): React.ReactNode {
  return (
    <Pressable
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="읽기와 뜻 보기"
    >
      <Text style={styles.label}>읽기 · 뜻 보기</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: buttons.primary.backgroundColor,
    borderRadius: buttons.primary.borderRadius,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  pressed: { opacity: 0.86 },
  label: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: fontWeight.medium,
    color: colors.white,
  },
});

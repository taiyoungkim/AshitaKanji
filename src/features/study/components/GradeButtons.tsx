// Design Ref: §5.2 — 4단계 등급 버튼 (Again/Hard/Good/Easy).
// Plan SC: FSRS 4-grade. reveal 후에만 노출.
// 리디자인: 색상 코딩 대신 무채색 농도 램프(Again 연함 → Easy 진함)로 위계 표현.

import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { colors, fontWeight, radius, spacing } from '~/design/tokens';
import { Grade, GRADE_LABELS_KO } from '~/types/Grade';

interface Props {
  onGrade: (grade: Grade) => void;
  disabled?: boolean;
}

const ORDER: Grade[] = [Grade.Again, Grade.Hard, Grade.Good, Grade.Easy];

const FILL: Record<Grade, ViewStyle> = {
  [Grade.Again]: { backgroundColor: 'transparent', borderColor: colors.borderStrong },
  [Grade.Hard]: { backgroundColor: colors.surfaceMuted, borderColor: colors.surfaceMuted },
  [Grade.Good]: { backgroundColor: colors.borderStrong, borderColor: colors.borderStrong },
  [Grade.Easy]: { backgroundColor: colors.black, borderColor: colors.black },
};

const LABEL: Record<Grade, TextStyle> = {
  [Grade.Again]: { color: colors.textSecondary },
  [Grade.Hard]: { color: colors.text },
  [Grade.Good]: { color: colors.text },
  [Grade.Easy]: { color: colors.white },
};

export function GradeButtons({ onGrade, disabled }: Props): React.ReactNode {
  return (
    <View style={styles.row}>
      {ORDER.map((g) => (
        <Pressable
          key={g}
          style={({ pressed }) => [
            styles.btn,
            FILL[g],
            pressed && styles.pressed,
            disabled && styles.disabled,
          ]}
          onPress={() => onGrade(g)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={GRADE_LABELS_KO[g]}
        >
          <Text style={[styles.label, LABEL[g]]}>{GRADE_LABELS_KO[g]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  btn: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  pressed: { opacity: 0.86 },
  disabled: { opacity: 0.4 },
  label: { fontSize: 15, lineHeight: 20, fontWeight: fontWeight.medium },
});

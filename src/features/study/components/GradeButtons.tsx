// Design Ref: §5.2 — 4단계 등급 버튼 (Again/Hard/Good/Easy).
// Plan SC: FSRS 4-grade. reveal 후에만 노출.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Grade, GRADE_LABELS_KO } from '~/types/Grade';

interface Props {
  onGrade: (grade: Grade) => void;
  disabled?: boolean;
}

const ORDER: Grade[] = [Grade.Again, Grade.Hard, Grade.Good, Grade.Easy];
const COLOR: Record<Grade, string> = {
  [Grade.Again]: '#d73a49',
  [Grade.Hard]: '#e36209',
  [Grade.Good]: '#2188ff',
  [Grade.Easy]: '#28a745',
};

export function GradeButtons({ onGrade, disabled }: Props): React.ReactNode {
  return (
    <View style={styles.row}>
      {ORDER.map((g) => (
        <Pressable
          key={g}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: COLOR[g] },
            pressed && styles.pressed,
            disabled && styles.disabled,
          ]}
          onPress={() => onGrade(g)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={GRADE_LABELS_KO[g]}
        >
          <Text style={styles.label}>{GRADE_LABELS_KO[g]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.4 },
  label: { color: 'white', fontSize: 15, fontWeight: '700' },
});

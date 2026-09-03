// Design Ref: Onikan handoff 화면 2 (`1b`) — 하단 액션(표현 전용).
//
// 공개 전에는 주요 액션 하나("뜻 보기"), 공개 후에는 2지선다다.
// 나란한 두 버튼에는 오렌지를 쓰지 않고 outline↔ink 로 층을 만든다.

import { StyleSheet, View } from 'react-native';
import { layout, spacing, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';
import { Button } from '~/components/ui/Button';

interface Props {
  revealed: boolean;
  onReveal: () => void;
  revealLabel?: string;
  /** 약한 쪽(outline) — "아직이에요" / "모름". */
  negativeLabel: string;
  onNegative: () => void;
  /** 강한 쪽(ink) — "외웠어요" / "안다". */
  positiveLabel: string;
  onPositive: () => void;
  disabled?: boolean;
}

export function StudyActionBar({
  revealed,
  onReveal,
  revealLabel = '뜻 보기',
  negativeLabel,
  onNegative,
  positiveLabel,
  onPositive,
  disabled,
}: Props): React.ReactNode {
  const styles = useThemedStyles(makeStyles);

  if (!revealed) {
    return (
      <View style={styles.wrap}>
        <Button label={revealLabel} onPress={onReveal} disabled={disabled} />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, styles.gradeRow]}>
      <Button
        label={negativeLabel}
        variant="outline"
        tall
        style={styles.grade}
        onPress={onNegative}
        disabled={disabled}
      />
      <Button
        label={positiveLabel}
        variant="ink"
        tall
        style={styles.grade}
        onPress={onPositive}
        disabled={disabled}
      />
    </View>
  );
}

const makeStyles = (_c: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: layout.gutter,
      paddingTop: layout.gutter,
      paddingBottom: spacing.xxl,
    },
    gradeRow: { flexDirection: 'row', gap: 10 },
    grade: { flex: 1 },
  });

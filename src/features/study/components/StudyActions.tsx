// Design Ref: Onikan handoff 화면 2 (`1b`) — 하단 액션.
//
// 공개 전에는 주요 액션 하나("뜻 보기"), 공개 후에는 2단계 자가평가다.
// 4단계(모름·어려움·앎·쉬움)에서 망설임의 원인은 "어려움/앎"의 경계가 모호한 것이었다.
// 사용자는 "알겠다/모르겠다"만 즉각 판단하면 된다.
//
// 두 라벨 모두 '현재 내 상태'로 맞춘다 — "또 볼래요" 같은 의사 표현은 시제 축이 달라
// "외웠어요"와 나란히 비교되지 않는다. 다음 복습 시점은 버튼에 쓰지 않는다(판단을 늘린다).

import { StyleSheet, View } from 'react-native';
import { layout, spacing, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';
import { Button } from '~/components/ui/Button';
import { Grade } from '~/types/Grade';

interface Props {
  revealed: boolean;
  onReveal: () => void;
  onGrade: (grade: Grade) => void;
  disabled?: boolean;
}

export function StudyActions({ revealed, onReveal, onGrade, disabled }: Props): React.ReactNode {
  const styles = useThemedStyles(makeStyles);

  if (!revealed) {
    return (
      <View style={styles.wrap}>
        <Button label="뜻 보기" onPress={onReveal} disabled={disabled} />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, styles.gradeRow]}>
      <Button
        label="아직이에요"
        variant="outline"
        tall
        style={styles.grade}
        onPress={() => onGrade(Grade.Again)}
        disabled={disabled}
      />
      <Button
        label="외웠어요"
        variant="ink"
        tall
        style={styles.grade}
        onPress={() => onGrade(Grade.Good)}
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

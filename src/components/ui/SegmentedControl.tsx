// Onikan 세그먼트 컨트롤 — 홈의 오늘 학습↔회독처럼 화면의 '모드'를 바꾼다.
//
// 두 번째 버튼으로 만들면 화면에 주요 액션이 둘이 된다. 상단 세그먼트로 올리면
// 상태 전환이 되고 하단 오렌지 CTA 는 계속 하나로 유지된다.

import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { font, layout, radius, spacing, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
}: Props<T>): React.ReactNode {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={[styles.track, style]}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.item, on && styles.itemOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      gap: spacing.xs,
      padding: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: c.soft,
    },
    item: {
      flex: 1,
      minHeight: layout.touchTarget,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // 그림자를 넣지 않는다 — soft 트랙 위의 흰 면만으로 활성 상태가 읽히고,
    // Level 1 은 card·toast 전용이다.
    itemOn: { backgroundColor: c.canvas },
    label: { fontFamily: font.semibold, fontSize: 16, lineHeight: 20, color: c.body },
    labelOn: { color: c.ink },
  });

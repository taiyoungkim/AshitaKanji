import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '~/design/tokens';
import type { OnigiriProgressStatus } from '../progress';

interface Props {
  status?: OnigiriProgressStatus;
  ingredientCount?: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

const DOTS = [
  { cx: 62, cy: 54 },
  { cx: 82, cy: 50 },
  { cx: 72, cy: 66 },
  { cx: 88, cy: 68 },
  { cx: 58, cy: 72 },
] as const;

export function OnigiriSketch({
  status = 'completed',
  ingredientCount = 4,
  size = 150,
  style,
}: Props): React.ReactNode {
  const locked = status === 'locked';
  const stroke = locked ? colors.borderStrong : colors.text;
  const dotCount = status === 'completed' ? DOTS.length : Math.max(0, Math.min(DOTS.length, ingredientCount + 1));

  return (
    <View style={style}>
      <Svg
        width={size}
        height={Math.round(size * 0.92)}
        viewBox="0 0 150 138"
        fill="none"
      >
        <Path
          d="M74 10 C76 10 78 12 80 16 L132 116 C135 122 131 127 124 127 L26 127 C19 127 15 122 18 116 L70 16 C72 12 72 10 74 10 Z"
          stroke={stroke}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={locked ? '6 7' : undefined}
        />
        {!locked && (
          <>
            <Path
              d="M44 92 C58 86 92 86 106 93 L110 116 C111 122 107 124 101 124 L49 124 C43 124 39 121 40 115 Z"
              fill={colors.text}
            />
            {DOTS.slice(0, dotCount).map((dot) => (
              <Circle key={`${dot.cx}-${dot.cy}`} cx={dot.cx} cy={dot.cy} r={1.6} fill={colors.text} />
            ))}
          </>
        )}
      </Svg>
    </View>
  );
}

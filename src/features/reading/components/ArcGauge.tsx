import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { typography, type ThemeColors } from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';

const SIZE = 78;
const R = 30;
const C = 2 * Math.PI * R;

export function ArcGauge({ progress, label }: { progress: number; label: string }): React.ReactNode {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const value = Math.min(Math.max(progress, 0), 1);
  const percent = Math.round(value * 100);
  const offset = C * (1 - value);

  return (
    <View style={styles.root} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}>
      <View style={styles.ring}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Circle cx={39} cy={39} r={R} fill="none" stroke={colors.soft} strokeWidth={8} />
          <Circle
            cx={39}
            cy={39}
            r={R}
            fill="none"
            stroke={colors.primary}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={`${C.toFixed(1)} ${C.toFixed(1)}`}
            strokeDashoffset={offset.toFixed(1)}
            transform="rotate(-90 39 39)"
          />
        </Svg>
        <Text style={styles.value}>{percent}%</Text>
      </View>
      <Text style={styles.label}>{label} 전체</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { alignItems: 'center', gap: 2 },
    ring: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
    value: {
      ...typography.bodyStrong,
      position: 'absolute',
      color: c.ink,
      fontSize: 19,
      lineHeight: 24,
      fontVariant: ['tabular-nums'],
    },
    label: { ...typography.captionStrong, color: c.body },
  });

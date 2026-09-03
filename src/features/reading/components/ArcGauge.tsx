import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { typography, type ThemeColors } from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';

// Design Ref: 회독 홈 hero-card — 하단이 열린 250° 아크 게이지, 레벨/퍼센트는 아크 안쪽.
const SIZE = 88;
const STROKE = 8;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const SWEEP = 250;
const ARC = C * (SWEEP / 360);
const START = 90 + (360 - SWEEP) / 2; // 아크 시작각(3시 기준 시계방향) — 빈 구간이 정중앙 하단.

export function ArcGauge({ progress, label }: { progress: number; label: string }): React.ReactNode {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const value = Math.min(Math.max(progress, 0), 1);
  const percent = Math.round(value * 100);
  const center = SIZE / 2;

  return (
    <View style={styles.root} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle
          cx={center}
          cy={center}
          r={R}
          fill="none"
          stroke={colors.soft}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${ARC.toFixed(1)} ${C.toFixed(1)}`}
          transform={`rotate(${START} ${center} ${center})`}
        />
        {value > 0 ? (
          <Circle
            cx={center}
            cy={center}
            r={R}
            fill="none"
            stroke={colors.primary}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${(ARC * value).toFixed(1)} ${C.toFixed(1)}`}
            transform={`rotate(${START} ${center} ${center})`}
          />
        ) : null}
      </Svg>
      <View style={styles.copy} pointerEvents="none">
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{percent}%</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
    copy: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    label: { ...typography.caption, color: c.mute },
    value: {
      ...typography.bodyStrong,
      color: c.ink,
      fontSize: 19,
      lineHeight: 24,
      fontVariant: ['tabular-nums'],
    },
  });

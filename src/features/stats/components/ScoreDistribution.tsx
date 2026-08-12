// 내 과거 학습 점수 분포.
//
// 모집단 데이터가 없으므로 "전체 학습자의 N%" 같은 문구는 쓰지 않는다.
// 비교 대상은 언제나 내 지난 기록이다.

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path, Rect, ClipPath, Defs, G } from 'react-native-svg';
import { font, layout, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import { useReducedMotion } from '~/hooks/useReducedMotion';
import {
  buildDensityCurve,
  CHART_HEIGHT,
  densityToY,
  markerDensity,
  PLOT_BOTTOM,
  PLOT_TOP,
  scoreToX,
} from '../recordChart';
import type { PersonalComparison } from '../recordTypes';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface Props {
  comparison: PersonalComparison;
  currentPercent: number;
  /** 화면의 유일한 오렌지. 카드 안에 두는 것이 디자인 계약이다. */
  cta: React.ReactNode;
}

export function ScoreDistribution({ comparison, currentPercent, cta }: Props): React.ReactNode {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(0);

  const reveal = useRef(new Animated.Value(1)).current;
  const marker = useRef(new Animated.Value(1)).current;

  const ready = comparison.kind === 'ready';

  useEffect(() => {
    if (!ready || reducedMotion === null) return;
    if (reducedMotion) {
      reveal.setValue(1);
      marker.setValue(1);
      return;
    }
    reveal.setValue(0);
    marker.setValue(0);
    const animation = Animated.parallel([
      Animated.timing(reveal, {
        toValue: 1,
        delay: 500,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        // SVG 속성 보간이라 네이티브 드라이버를 쓸 수 없다.
        useNativeDriver: false,
      }),
      Animated.timing(marker, {
        toValue: 1,
        delay: 1100,
        duration: 320,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [ready, reducedMotion, reveal, marker]);

  if (comparison.kind === 'insufficient') {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>내 학습 점수 분포</Text>
        <Text style={styles.empty}>학습 기록이 쌓이면 비교할 수 있어요</Text>
        <View style={styles.cta}>{cta}</View>
      </View>
    );
  }

  const curve = buildDensityCurve(comparison.samples);
  const path = curve
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${scoreToX(p.x, width)} ${densityToY(p.density)}`)
    .join(' ');
  const area = width > 0 ? `${path} L${scoreToX(100, width)} ${PLOT_BOTTOM} L${scoreToX(0, width)} ${PLOT_BOTTOM} Z` : '';

  const meanX = scoreToX(comparison.mean, width);
  const markerX = scoreToX(currentPercent, width);
  const markerY = densityToY(markerDensity(currentPercent, comparison.samples));

  return (
    <View style={styles.card}>
      <Text style={styles.title}>내 학습 점수 분포</Text>
      <Text style={styles.lead}>
        지난 학습 기록의 {Math.round(comparison.percentile)}%보다 높아요
      </Text>

      <View style={styles.chart} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <>
            <Svg width={width} height={CHART_HEIGHT}>
              <Defs>
                <ClipPath id="reveal">
                  {/* 곡선을 왼쪽부터 드러낸다. */}
                  <AnimatedRect
                    x={0}
                    y={0}
                    height={CHART_HEIGHT}
                    width={reveal.interpolate({ inputRange: [0, 1], outputRange: [0, width] })}
                  />
                </ClipPath>
              </Defs>
              <G clipPath="url(#reveal)">
                <Path d={area} fill={colors.soft} />
                <Path
                  d={path}
                  stroke={colors.ink}
                  strokeWidth={2}
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                />
              </G>
              <Line
                x1={meanX}
                y1={PLOT_TOP}
                x2={meanX}
                y2={PLOT_BOTTOM}
                stroke={colors.pressed}
                strokeWidth={1}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
            </Svg>

            {/* '나' 마커는 SVG 밖의 원으로 그려 폰트·그림자를 그대로 쓴다. */}
            <Animated.View
              style={[
                styles.marker,
                {
                  left: markerX - 5,
                  top: markerY - 5,
                  opacity: marker,
                  transform: [{ scale: marker }],
                },
              ]}
            />
            <Animated.Text
              style={[
                styles.markerLabel,
                { left: markerX - 10, top: markerY - 26, opacity: marker },
              ]}
            >
              나
            </Animated.Text>
          </>
        )}
      </View>

      <View style={styles.axis}>
        <Text style={styles.axisLabel}>0%</Text>
        <Text style={styles.axisLabel}>평균 {Math.round(comparison.mean)}%</Text>
        <Text style={styles.axisLabel}>100%</Text>
      </View>

      <View style={styles.cta}>{cta}</View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.canvas,
      borderRadius: 24,
      padding: layout.gutter,
      gap: layout.gapTight,
    },
    title: { ...typography.cardTitle, color: c.ink },
    lead: { ...typography.body, color: c.body },
    empty: { ...typography.body, color: c.body, paddingVertical: spacing.xl },
    chart: { height: CHART_HEIGHT, position: 'relative' },
    marker: {
      position: 'absolute',
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: c.primary,
    },
    markerLabel: {
      position: 'absolute',
      fontFamily: font.semibold,
      fontSize: 12,
      lineHeight: 16,
      color: c.ink,
      width: 20,
      textAlign: 'center',
    },
    axis: { flexDirection: 'row', justifyContent: 'space-between' },
    axisLabel: { ...typography.caption, color: c.body },
    cta: { marginTop: spacing.xs },
  });

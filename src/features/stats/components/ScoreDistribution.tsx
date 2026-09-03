// 내 과거 학습 점수 분포.
//
// 모집단 데이터가 없으므로 "전체 학습자의 N%" 같은 문구는 쓰지 않는다.
// 비교 대상은 언제나 내 지난 기록이다.
//
// 막대는 아래→위 scaleY rise (onikan-interactions.html). 내 구간만 오렌지 + "나".

import { useCallback, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { font, layout, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';
import { useReducedMotion } from '~/hooks/useReducedMotion';
import { AnimatedNumber } from '~/components/ui/AnimatedNumber';
import {
  binIndexFor,
  buildScoreHistogram,
  CHART_HEIGHT,
  MARKER_HEADROOM,
} from '../recordChart';
import type { PersonalComparison } from '../recordTypes';

/** 값이 0 인 구간도 자리를 잃지 않도록 남기는 최소 높이. */
const MIN_BAR_HEIGHT = 6;
const RISE_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const POP_EASING = Easing.bezier(0.34, 1.56, 0.64, 1);

interface Props {
  comparison: PersonalComparison;
  currentPercent: number;
  cta: React.ReactNode;
}

function DistributionBar({
  height,
  mine,
  index,
}: {
  height: number;
  mine: boolean;
  index: number;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const reducedMotion = useReducedMotion();
  const rise = useRef(new Animated.Value(1)).current;
  const label = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      if (reducedMotion !== false) {
        rise.setValue(1);
        label.setValue(1);
        return;
      }
      rise.setValue(0);
      label.setValue(0);
      const bar = Animated.timing(rise, {
        toValue: 1,
        delay: 500 + index * 50,
        duration: 500,
        easing: RISE_EASING,
        useNativeDriver: true,
      });
      const you = mine
        ? Animated.timing(label, {
            toValue: 1,
            delay: 1150,
            duration: 420,
            easing: POP_EASING,
            useNativeDriver: true,
          })
        : null;
      bar.start();
      you?.start();
      return () => {
        bar.stop();
        you?.stop();
      };
    }, [index, label, mine, reducedMotion, rise]),
  );

  return (
    <View style={styles.column}>
      <View style={styles.barWrap}>
        {mine ? (
          <Animated.View
            style={[
              styles.marker,
              {
                opacity: label,
                transform: [
                  { translateY: label.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
                  { scale: label.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                ],
              },
            ]}
          >
            <Text style={styles.markerLabel}>나</Text>
          </Animated.View>
        ) : null}
        <Animated.View
          style={[
            styles.bar,
            mine && styles.barMine,
            {
              height,
              transformOrigin: 'bottom',
              transform: [{ scaleY: rise }],
            },
          ]}
        />
      </View>
    </View>
  );
}

export function ScoreDistribution({ comparison, currentPercent, cta }: Props): React.ReactNode {
  const styles = useThemedStyles(makeStyles);

  if (comparison.kind === 'insufficient') {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>내 학습 점수 분포</Text>
        <Text style={styles.empty}>학습 기록이 쌓이면 비교할 수 있어요</Text>
        <View style={styles.cta}>{cta}</View>
      </View>
    );
  }

  const bins = buildScoreHistogram(comparison.samples);
  const currentBin = binIndexFor(currentPercent);
  const barSpace = CHART_HEIGHT - MARKER_HEADROOM;
  const percentile = Math.round(comparison.percentile);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>내 학습 점수 분포</Text>
      <Text style={styles.lead}>
        지난 학습 기록의{' '}
        <AnimatedNumber value={percentile} delay={150} style={styles.lead} />
        %보다 높아요
      </Text>

      <View style={styles.chart}>
        {bins.map((bin, index) => (
          <DistributionBar
            key={bin.from}
            index={index}
            mine={index === currentBin}
            height={Math.max(MIN_BAR_HEIGHT, bin.ratio * barSpace)}
          />
        ))}
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
      borderRadius: 22,
      padding: layout.gutter,
      gap: layout.gapTight,
    },
    title: { ...typography.cta, color: c.ink },
    lead: { ...typography.caption, color: c.body },
    empty: { ...typography.body, color: c.body, paddingVertical: spacing.xl },

    chart: {
      height: CHART_HEIGHT,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 6,
      paddingTop: MARKER_HEADROOM,
    },
    column: { flex: 1, justifyContent: 'flex-end' },
    barWrap: { position: 'relative', width: '100%' },
    bar: { width: '100%', borderRadius: 4, backgroundColor: c.soft },
    barMine: { backgroundColor: c.primary },
    marker: { position: 'absolute', left: 0, right: 0, top: -22, alignItems: 'center' },
    markerLabel: { fontFamily: font.semibold, fontSize: 13, lineHeight: 16, color: c.primary },

    axis: { flexDirection: 'row', justifyContent: 'space-between' },
    axisLabel: { ...typography.caption, color: c.body },
    cta: { alignItems: 'center', marginTop: spacing.lg },
  });

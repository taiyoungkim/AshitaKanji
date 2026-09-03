import { useCallback, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';
import { useReducedMotion } from '~/hooks/useReducedMotion';
import { onboardingImages } from '~/features/onigiri/onboardingAssets';
import { StampIcon } from './StampIcon';

interface Props {
  days: number;
  total?: number;
  /** 기록 탭: earned 도장만 pop-in. 홈 단골 카드는 끈다. */
  animate?: boolean;
}

const POP_EASING = Easing.bezier(0.34, 1.56, 0.64, 1);

function StampCell({
  active,
  index,
  animate,
}: {
  active: boolean;
  index: number;
  animate: boolean;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      if (!animate || !active || reducedMotion !== false) {
        scale.setValue(1);
        opacity.setValue(1);
        return;
      }
      scale.setValue(0.3);
      opacity.setValue(0);
      const animation = Animated.parallel([
        Animated.timing(scale, {
          toValue: 1,
          delay: 500 + index * 50,
          duration: 440,
          easing: POP_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          delay: 500 + index * 50,
          duration: 220,
          useNativeDriver: true,
        }),
      ]);
      animation.start();
      return () => animation.stop();
    }, [active, animate, index, opacity, reducedMotion, scale]),
  );

  const stamp = <StampIcon earned={active} size={56} />;

  if (!animate || !active) {
    return <View style={styles.stampCell}>{stamp}</View>;
  }

  return (
    <Animated.View style={[styles.stampCell, { opacity, transform: [{ scale }] }]}>
      {stamp}
    </Animated.View>
  );
}

/** Figma `도장`(Group 50 SVG) — 획득은 오렌지 고양이, 미획득은 같은 실루엣 회색. */
export function StreakStamps({ days, total = 10, animate = false }: Props): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const earned = Math.min(Math.max(days, 0), total);
  const stamps = Array.from({ length: total }, (_, index) => (
    <StampCell key={index} active={index < earned} index={index} animate={animate} />
  ));

  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: earned }}
      accessibilityLabel={`단골 도장 ${earned}개`}
    >
      <View style={styles.stampLine}>{stamps.slice(0, 5)}</View>
      <View style={styles.stampLine}>{stamps.slice(5, 10)}</View>
    </View>
  );
}

function LimeWeekStamps({ days }: { days: number }): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const earned = Math.min(Math.max(days, 0), 7);
  return (
    <View
      style={styles.limeRow}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 7, now: earned }}
      accessibilityLabel={`단골 도장 ${earned}개`}
    >
      {Array.from({ length: 7 }, (_, index) => (
        <View key={index} style={[styles.limeStamp, index < earned ? styles.limeOn : styles.limeOff]} />
      ))}
    </View>
  );
}

export function StreakCard({ days }: { days: number }): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>단골 {days}일차</Text>
      {days > 0 ? (
        <LimeWeekStamps days={days} />
      ) : (
        <Image
          source={onboardingImages.regularEmpty}
          style={styles.emptyArt}
          resizeMode="contain"
          accessibilityLabel="아직 단골이 아니에요"
        />
      )}
      <Text style={styles.caption}>
        {days > 0 ? '단골 혜택 · 다음 학습 재료 2배' : '학습을 시작하면 단골 혜택을 받아요'}
      </Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    row: { gap: 12, overflow: 'visible' },
    stampLine: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      overflow: 'visible',
    },
    stampCell: { width: 56, height: 56, overflow: 'visible' },
    limeRow: { flexDirection: 'row', gap: 8, marginTop: 4, overflow: 'visible' },
    limeStamp: { width: 34, height: 34, borderRadius: 17 },
    limeOn: { backgroundColor: c.secondary },
    limeOff: { borderWidth: 2, borderColor: c.pressed, backgroundColor: 'transparent' },
    card: { backgroundColor: c.canvas, borderRadius: radius.card, padding: 22, gap: spacing.md },
    title: { ...typography.cardTitle, color: c.ink },
    emptyArt: { width: 120, height: 120, alignSelf: 'center' },
    caption: { ...typography.caption, color: c.body },
  });

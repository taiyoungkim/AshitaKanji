// 재료를 받은 순간의 축하 연출 — 라임 체크 뱃지, 퍼지는 링, 스파크 5개.
//
// 라임이 등장하는 몇 안 되는 자리다. 보상이 없으면 이 컴포넌트를 아예 렌더하지 않는다
// (호출부가 판단한다). 콘페티·무한 펄스는 규칙상 금지라 각 트랙은 1회만 돈다.

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { radius, type ThemeColors } from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import { IconCheck } from '~/design/icons';
import { REWARD_TIMELINE, SPARK_FADE_MS, SPARK_VECTORS } from '../rewardMotion';

interface Props {
  /** 시퀀스를 다시 돌릴지 결정하는 키. 같으면 재실행하지 않는다. */
  runKey: string;
  /** true 면 모든 값을 최종 상태로 두고 애니메이션을 돌리지 않는다. */
  instant: boolean;
}

export function RewardBurst({ runKey, instant }: Props): React.ReactNode {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const badge = useRef(new Animated.Value(instant ? 1 : 0)).current;
  const ring = useRef(new Animated.Value(instant ? 1 : 0)).current;
  const spark = useRef(new Animated.Value(instant ? 1 : 0)).current;

  useEffect(() => {
    if (instant) {
      badge.setValue(1);
      ring.setValue(1);
      spark.setValue(1);
      return;
    }

    badge.setValue(0);
    ring.setValue(0);
    spark.setValue(0);

    const animation = Animated.parallel([
      Animated.timing(badge, {
        toValue: 1,
        delay: REWARD_TIMELINE.checkBadge.delay,
        duration: REWARD_TIMELINE.checkBadge.duration,
        // 0.3 → 1.15 → 1 의 오버슈트를 back easing 으로 만든다.
        easing: Easing.out(Easing.back(2.2)),
        useNativeDriver: true,
      }),
      Animated.timing(ring, {
        toValue: 1,
        delay: REWARD_TIMELINE.ring.delay,
        duration: REWARD_TIMELINE.ring.duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(spark, {
        toValue: 1,
        delay: REWARD_TIMELINE.sparks.delay,
        duration: REWARD_TIMELINE.sparks.duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    animation.start();
    // 언마운트 시 진행 중인 애니메이션을 멈춘다.
    return () => animation.stop();
  }, [runKey, instant, badge, ring, spark]);

  // 스파크의 라임 잔상은 전체 길이의 앞부분에서만 보인다.
  const sparkFadeStop = SPARK_FADE_MS / REWARD_TIMELINE.sparks.duration;

  return (
    <View pointerEvents="none" style={styles.stage}>
      <Animated.View
        style={[
          styles.ring,
          {
            opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
            transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.7, 2.1] }) }],
          },
        ]}
      />

      {SPARK_VECTORS.map((vector, i) => (
        <Animated.View
          key={i}
          style={[
            styles.spark,
            {
              opacity: spark.interpolate({
                inputRange: [0, sparkFadeStop, 1],
                outputRange: [1, 0, 0],
              }),
              transform: [
                { translateX: spark.interpolate({ inputRange: [0, 1], outputRange: [0, vector.x] }) },
                { translateY: spark.interpolate({ inputRange: [0, 1], outputRange: [0, vector.y] }) },
              ],
            },
          ]}
        />
      ))}

      <Animated.View
        style={[
          styles.badge,
          {
            opacity: badge,
            transform: [{ scale: badge.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
          },
        ]}
      >
        <IconCheck size={19} color={colors.onSecondary} />
      </Animated.View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    // 재료 타일의 우하단에 겹쳐 놓는다. 부모가 position: relative 여야 한다.
    stage: {
      position: 'absolute',
      right: -6,
      bottom: -6,
      width: 30,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      width: 30,
      height: 30,
      borderRadius: radius.pill,
      backgroundColor: c.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ring: {
      position: 'absolute',
      width: 30,
      height: 30,
      borderRadius: radius.pill,
      borderWidth: 2,
      borderColor: c.secondary,
    },
    spark: {
      position: 'absolute',
      width: 6,
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: c.secondary,
    },
  });

import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from '~/hooks/useReducedMotion';
import {
  buildOnboardingParticles,
  ONBOARDING_CONFETTI_DELAY_MS,
  ONBOARDING_CONFETTI_DURATION_MS,
} from '../onboardingMotion';

export function OnboardingConfetti({ runKey }: { runKey: string }): React.ReactNode {
  const reducedMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const particles = useMemo(() => buildOnboardingParticles(), []);

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    if (reducedMotion !== false) return;

    const animation = Animated.timing(progress, {
      toValue: 1,
      delay: ONBOARDING_CONFETTI_DELAY_MS,
      duration: ONBOARDING_CONFETTI_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reducedMotion, runKey]);

  if (reducedMotion !== false) return null;

  return (
    <View pointerEvents="none" style={styles.layer} accessibilityElementsHidden>
      {particles.map((particle) => {
        const riseEnd = Math.min(particle.endRatio - 0.1, particle.delayRatio + 0.16);
        return (
          <Animated.View
            key={particle.id}
            style={{
              position: 'absolute',
              left: width * particle.xRatio,
              top: height * particle.yRatio,
              width: particle.width,
              height: particle.height,
              borderRadius: 1,
              backgroundColor: particle.color,
              opacity: progress.interpolate({
                inputRange: [0, particle.delayRatio, particle.delayRatio + 0.03, particle.endRatio - 0.12, particle.endRatio, 1],
                outputRange: [0, 0, 1, 1, 0, 0],
              }),
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, particle.delayRatio, particle.endRatio, 1],
                    outputRange: [0, 0, particle.drift, particle.drift],
                  }),
                },
                {
                  translateY: progress.interpolate({
                    inputRange: [0, particle.delayRatio, riseEnd, particle.endRatio, 1],
                    outputRange: [0, 0, -particle.pop, particle.fall, particle.fall],
                  }),
                },
                {
                  rotate: progress.interpolate({
                    inputRange: [0, particle.delayRatio, particle.endRatio, 1],
                    outputRange: ['0deg', '0deg', `${particle.rotation}deg`, `${particle.rotation}deg`],
                  }),
                },
              ],
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, zIndex: 50, overflow: 'hidden' },
});

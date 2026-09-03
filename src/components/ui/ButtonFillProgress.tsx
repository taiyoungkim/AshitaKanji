import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { layout, motion, radius, typography, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';
import { useReducedMotion } from '~/hooks/useReducedMotion';

interface Props {
  label: string;
  onPress: () => void;
  /**
   * guide/studyComplete는 순수 진행 표시이며 이동은 탭으로만 한다.
   * autoAdvance만 2초 카운트다운 뒤 자동으로 onPress를 호출한다.
   */
  mode?: 'guide' | 'studyComplete' | 'autoAdvance';
  style?: StyleProp<ViewStyle>;
  /** 시각 회귀 fixture 전용. 모션과 자동 전환을 고정한다. */
  frozenProgress?: number;
}

export function ButtonFillProgress({ label, onPress, mode = 'guide', style, frozenProgress }: Props): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const reducedMotion = useReducedMotion();
  const fill = useRef(new Animated.Value(0)).current;
  const completed = useRef(false);
  const actionRef = useRef(onPress);
  actionRef.current = onPress;

  useEffect(() => {
    if (frozenProgress != null) {
      fill.stopAnimation();
      fill.setValue(Math.max(0, Math.min(1, frozenProgress)));
      return;
    }
    if (reducedMotion === null) return;
    fill.stopAnimation();
    completed.current = false;
    if (reducedMotion) {
      fill.setValue(1);
      return;
    }
    fill.setValue(0);
    const animation = Animated.timing(fill, {
      toValue: 1,
      duration:
        mode === 'studyComplete'
          ? motion.studyCompleteFillMs
          : mode === 'autoAdvance'
            ? motion.buttonAutoFillMs
            : motion.guideFillMs,
      easing:
        mode === 'autoAdvance'
          ? Easing.linear
          : Easing.bezier(0.25, 0.46, 0.45, 0.94),
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished && mode === 'autoAdvance' && !completed.current) {
        completed.current = true;
        actionRef.current();
      }
    });
    return () => animation.stop();
  }, [fill, frozenProgress, mode, reducedMotion]);

  const activate = () => {
    if (completed.current) return;
    completed.current = true;
    fill.stopAnimation();
    fill.setValue(1);
    onPress();
  };

  return (
    <Pressable style={[styles.track, style]} onPress={activate} accessibilityRole="button" accessibilityLabel={label}>
      <Animated.View
        pointerEvents="none"
        style={[styles.fill, { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
      />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    track: { minHeight: layout.ctaHeight, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: '#9A9AA1', alignItems: 'center', justifyContent: 'center' },
    fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: c.ink },
    label: { ...typography.cta, color: c.onInk, zIndex: 1 },
  });

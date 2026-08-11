import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * 시스템의 모션 감소 설정을 구독한다.
 * null은 네이티브 설정을 아직 읽지 못한 짧은 초기 구간이다.
 */
export function useReducedMotion(): boolean | null {
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (alive) setReducedMotion(enabled);
      })
      .catch(() => {
        if (alive) setReducedMotion(false);
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion,
    );

    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

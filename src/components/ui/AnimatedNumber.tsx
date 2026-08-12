// 0에서 목표값까지 세는 숫자.
//
// tabular figures 를 유지해야 자릿수가 바뀔 때 좌우로 떨리지 않는다.
// 모션 감소면 세지 않고 목표값을 바로 보여준다 — 정보량은 같아야 한다.

import { useEffect, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { countUpValue } from '~/features/done/rewardMotion';
import { useReducedMotion } from '~/hooks/useReducedMotion';

interface Props {
  value: number;
  /** 카운트업 길이(ms). */
  duration?: number;
  /** 시작 지연(ms). */
  delay?: number;
  style?: StyleProp<TextStyle>;
  /** 숫자 앞뒤에 붙는 고정 문자열 (예: "/ 4"). */
  suffix?: string;
  /** 애니메이션을 다시 돌릴지 결정하는 키. 같으면 재실행하지 않는다. */
  runKey?: string;
}

export function AnimatedNumber({
  value,
  duration = 550,
  delay = 0,
  style,
  suffix,
  runKey,
}: Props): React.ReactNode {
  const reducedMotion = useReducedMotion();
  // null 은 설정을 아직 읽지 못한 구간이다. 그때 세기 시작하면 모션 감소 사용자에게
  // 원치 않는 카운트업이 잠깐 보인다 — 판정이 날 때까지 최종값을 그대로 둔다.
  const animates = reducedMotion === false && duration > 0;
  const [shown, setShown] = useState(value);
  const frameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!animates) {
      setShown(value);
      return;
    }

    setShown(0);
    let start = 0;

    const step = (now: number) => {
      if (start === 0) start = now;
      const progress = (now - start) / duration;
      if (progress >= 1) {
        setShown(value);
        frameRef.current = null;
        return;
      }
      setShown(countUpValue(value, progress));
      frameRef.current = requestAnimationFrame(step);
    };

    timerRef.current = setTimeout(() => {
      frameRef.current = requestAnimationFrame(step);
    }, delay);

    // 언마운트·재실행 시 프레임과 타이머를 모두 정리한다.
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      timerRef.current = null;
      frameRef.current = null;
    };
  }, [value, duration, delay, animates, runKey]);

  return (
    <Text style={style} allowFontScaling>
      {shown}
      {suffix}
    </Text>
  );
}

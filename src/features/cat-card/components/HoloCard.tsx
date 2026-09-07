// 홀로 카드. Plan Ref: §7.2 AD-02 — Skia 없이 RN 0.81 네이티브 스타일로 구현한다.
//   mix-blend-mode  -> mixBlendMode
//   linear-gradient -> experimental_backgroundImage
//   filter          -> filter
// Plan Ref: §7.2 AD-06 — 기울기는 상대 기준점 + 중력 벡터 + low-pass.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { DeviceMotion } from 'expo-sensors';
import { radius } from '~/design/tokens';
import { useReducedMotion } from '~/hooks/useReducedMotion';
import { CARD_ASPECT_RATIO, type CatCard, type Rarity } from '../catalog';
import { cardImage } from '../cardAssets';

/** -1 ~ 1 로 정규화된 기울기. */
export interface Tilt {
  x: number;
  y: number;
}

const NEUTRAL: Tilt = { x: 0, y: 0 };
const SAMPLE_INTERVAL_MS = 1000 / 40; // Plan Ref: NFR — 30~40Hz 면 충분하다
const SMOOTHING = 0.15; // low-pass 계수. 낮을수록 부드럽고 느리다
const MAX_RADIANS = 0.5; // 이 각도에서 기울기가 ±1 로 포화된다

function clamp(value: number, limit = 1): number {
  return Math.max(-limit, Math.min(limit, value));
}

/**
 * 기기 기울기를 구독한다.
 * 구독을 시작한 순간의 자세를 0점으로 잡아, 누워서 봐도 정상 동작한다.
 */
export function useTilt(enabled: boolean): { tilt: Tilt; recalibrate: () => void } {
  const [tilt, setTilt] = useState<Tilt>(NEUTRAL);
  const origin = useRef<{ beta: number; gamma: number } | null>(null);
  const smoothed = useRef<Tilt>(NEUTRAL);

  const recalibrate = useCallback(() => {
    origin.current = null;
    smoothed.current = NEUTRAL;
    setTilt(NEUTRAL);
  }, []);

  useEffect(() => {
    if (!enabled) {
      recalibrate();
      return;
    }
    let alive = true;
    DeviceMotion.setUpdateInterval(SAMPLE_INTERVAL_MS);
    const subscription = DeviceMotion.addListener(({ rotation }) => {
      // rotation 은 가속도계 중력 벡터 기준이라 자이로 적분과 달리 드리프트가 없다.
      if (!alive || !rotation) return;
      const { beta, gamma } = rotation;
      if (typeof beta !== 'number' || typeof gamma !== 'number') return;
      origin.current ??= { beta, gamma };

      const target = {
        x: clamp((gamma - origin.current.gamma) / MAX_RADIANS),
        y: clamp((beta - origin.current.beta) / MAX_RADIANS),
      };
      smoothed.current = {
        x: smoothed.current.x + (target.x - smoothed.current.x) * SMOOTHING,
        y: smoothed.current.y + (target.y - smoothed.current.y) * SMOOTHING,
      };
      setTilt(smoothed.current);
    });

    return () => {
      alive = false;
      subscription.remove(); // 화면을 벗어나면 즉시 해제한다 (배터리)
    };
  }, [enabled, recalibrate]);

  return { tilt, recalibrate };
}

/** 등급별 홀로 강도. 높을수록 무늬가 선명하고 크게 움직인다. */
const HOLO: Record<Rarity, { opacity: number; travel: number; blend: 'color-dodge' | 'overlay' | 'soft-light'; glow: string }> = {
  N: { opacity: 0.18, travel: 30, blend: 'soft-light', glow: 'rgba(140,150,170,0.45)' },
  R: { opacity: 0.42, travel: 60, blend: 'overlay', glow: 'rgba(90,150,255,0.65)' },
  SR: { opacity: 0.75, travel: 95, blend: 'color-dodge', glow: 'rgba(255,140,220,0.85)' },
};

const RAINBOW =
  'linear-gradient(115deg, transparent 12%, #ff6b8b 24%, #ffd76b 34%, #6bffb2 46%, #6bd5ff 58%, #b96bff 70%, transparent 84%)';
const SPARKLE =
  'linear-gradient(65deg, transparent 30%, rgba(255,255,255,0.9) 46%, transparent 62%)';

/** 프로토타입 진단용 스위치. 검정 카드 원인을 한 빌드 안에서 좁히기 위한 것이다. */
export interface HoloDebug {
  /** 홀로 레이어를 아예 붙이지 않는다. 끄고도 검정이면 이미지 쪽 문제다. */
  holo: boolean;
  /** 합성 모드를 강제한다. 'normal' 이면 blend 없이 단순 알파 합성. */
  blend: 'normal' | 'soft-light' | 'overlay' | 'color-dodge' | 'screen';
  /** 그라디언트 대신 단색 반투명을 쓴다. 단색에서 정상이면 그라디언트 파싱 문제다. */
  gradient: boolean;
  /** 프레임 배경을 검정 대신 회색으로. 회색이 보이면 이미지가 안 그려진 것이다. */
  blackBackdrop: boolean;
}

export const DEFAULT_DEBUG: HoloDebug = {
  holo: true,
  blend: 'normal',
  gradient: true,
  blackBackdrop: false,
};

export function HoloCard({
  card,
  tilt,
  width,
  debug = DEFAULT_DEBUG,
  onImageError,
}: {
  card: CatCard;
  tilt: Tilt;
  width: number;
  debug?: HoloDebug;
  onImageError?: (message: string) => void;
}): React.ReactNode {
  const reducedMotion = useReducedMotion();
  const holo = HOLO[card.rarity];
  // 모션 감소가 켜지면 무늬를 고정하고 움직임을 죽인다. Plan Ref: NFR-02
  const still = reducedMotion === true;
  const t = still ? NEUTRAL : tilt;
  // 'normal' 은 blend 를 아예 걸지 않는다. undefined 로 두면 격리 레이어도 안 만든다.
  const blend = debug.blend === 'normal' ? undefined : debug.blend;

  const styles = useMemo(
    () => makeStyles(width, width / CARD_ASPECT_RATIO),
    [width],
  );

  return (
    <View
      style={[
        styles.frame,
        { backgroundColor: debug.blackBackdrop ? '#000' : '#6E6E73' },
        {
          shadowColor: holo.glow,
          shadowOpacity: still ? 0.5 : 0.5 + Math.abs(t.x) * 0.4,
          transform: still
            ? []
            : [
                { perspective: 900 },
                { rotateY: `${t.x * 11}deg` },
                { rotateX: `${-t.y * 11}deg` },
              ],
        },
      ]}
    >
      <Image
        source={cardImage(card.imageKey)}
        style={styles.image}
        resizeMode="cover"
        onError={(e) => onImageError?.(String(e.nativeEvent?.error ?? 'unknown'))}
      />

      {debug.holo ? (
        <>
          <View
            pointerEvents="none"
            style={[
              styles.layer,
              {
                opacity: holo.opacity,
                mixBlendMode: blend,
                ...(debug.gradient
                  ? { experimental_backgroundImage: RAINBOW }
                  : { backgroundColor: 'rgba(255,120,180,0.6)' }),
                transform: [
                  { translateX: t.x * holo.travel },
                  { translateY: t.y * holo.travel * 0.5 },
                ],
              },
            ]}
          />

          <View
            pointerEvents="none"
            style={[
              styles.layer,
              {
                opacity: holo.opacity * 0.7,
                mixBlendMode: blend,
                ...(debug.gradient
                  ? { experimental_backgroundImage: SPARKLE }
                  : { backgroundColor: 'rgba(255,255,255,0.5)' }),
                transform: [{ translateX: -t.x * holo.travel * 1.6 }],
              },
            ]}
          />
        </>
      ) : null}
    </View>
  );
}

/** 도감 그리드용 축소 카드. 미보유는 실루엣으로 잠근다. */
export function CardThumb({
  card,
  owned,
  width,
  onPress,
}: {
  card: CatCard;
  owned: boolean;
  width: number;
  onPress?: () => void;
}): React.ReactNode {
  const styles = useMemo(() => makeStyles(width, width / CARD_ASPECT_RATIO), [width]);
  return (
    <Pressable
      onPress={onPress}
      disabled={!owned}
      accessibilityRole="button"
      accessibilityLabel={owned ? `${card.name}, ${card.rarity}` : '미보유 카드'}
      style={[styles.thumbFrame, !owned && styles.thumbLocked]}
    >
      <Image
        source={cardImage(card.imageKey)}
        style={[styles.image, !owned && styles.thumbHidden]}
        resizeMode="cover"
      />
    </Pressable>
  );
}

const makeStyles = (width: number, height: number) =>
  StyleSheet.create({
    frame: {
      width,
      height,
      borderRadius: radius.card,
      overflow: 'hidden',
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 22,
      elevation: 10,
    },
    image: { width: '100%', height: '100%' },
    layer: { ...StyleSheet.absoluteFillObject },
    thumbFrame: {
      width,
      height,
      borderRadius: radius.tileSm,
      overflow: 'hidden',
      backgroundColor: '#00000022',
    },
    thumbLocked: { opacity: 0.35 },
    thumbHidden: { opacity: 0, },
  });

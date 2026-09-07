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

/**
 * 등급별 홀로 강도.
 *
 * 등급 차이는 밝기가 아니라 채도와 움직임으로 읽히게 한다.
 * color-dodge 는 backdrop/(1-source) 라 밝은 바탕에서 흰색으로 타버린다.
 * 이 카드 아트는 흰 파스텔 프레임이라 특히 취약해서, 넓은 무지개 면에는 쓰지 않고
 * 얇은 스파클 띠에만 낮은 opacity 로 남긴다.
 * overlay 는 어두운 곳은 곱하고 밝은 곳은 스크린해서 사진이 살아 있는다.
 */
const HOLO: Record<
  Rarity,
  { opacity: number; sparkle: number; travel: number; blend: 'overlay' | 'soft-light'; glow: string }
> = {
  N: { opacity: 0.28, sparkle: 0.1, travel: 16, blend: 'soft-light', glow: 'rgba(140,150,170,0.45)' },
  R: { opacity: 0.45, sparkle: 0.16, travel: 28, blend: 'overlay', glow: 'rgba(90,150,255,0.65)' },
  SR: { opacity: 0.62, sparkle: 0.24, travel: 42, blend: 'overlay', glow: 'rgba(255,140,220,0.85)' },
};

// 무지개는 카드 전체를 덮는다. 양 끝을 transparent 로 두면 기울였을 때 맨 카드가 드러난다.
const RAINBOW =
  'linear-gradient(115deg, #ff6b8b 0%, #ffd76b 20%, #6bffb2 40%, #6bd5ff 60%, #b96bff 80%, #ff6b8b 100%)';
// 스파클만 띠로 쓸어간다. 이쪽은 양 끝이 비어야 띠로 보인다.
const SPARKLE =
  'linear-gradient(65deg, transparent 26%, rgba(255,255,255,0.95) 48%, transparent 70%)';

/**
 * 레이어는 카드보다 크게 잡는다.
 * 카드와 같은 크기면 translate 한 만큼 반대쪽 끝에 맨 카드가 드러난다.
 * 스파클이 travel 의 1.6배까지 움직이므로 2배로 여유를 둔다.
 */
function overscan(travel: number): { position: 'absolute'; top: number; left: number; right: number; bottom: number } {
  const m = -travel * 2;
  return { position: 'absolute', top: m, left: m, right: m, bottom: m };
}

export function HoloCard({
  card,
  tilt,
  width,
}: {
  card: CatCard;
  tilt: Tilt;
  width: number;
}): React.ReactNode {
  const reducedMotion = useReducedMotion();
  const holo = HOLO[card.rarity];
  // 모션 감소가 켜지면 무늬를 고정하고 움직임을 죽인다. Plan Ref: NFR-02
  const still = reducedMotion === true;
  const t = still ? NEUTRAL : tilt;

  const styles = useMemo(
    () => makeStyles(width, width / CARD_ASPECT_RATIO),
    [width],
  );

  return (
    <View
      style={[
        styles.frame,
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
      <Image source={cardImage(card.imageKey)} style={styles.image} resizeMode="cover" />

      <View
        pointerEvents="none"
        style={[
          overscan(holo.travel),
          {
            opacity: holo.opacity,
            mixBlendMode: holo.blend,
            experimental_backgroundImage: RAINBOW,
            transform: [{ translateX: t.x * holo.travel }, { translateY: t.y * holo.travel * 0.5 }],
          },
        ]}
      />

      <View
        pointerEvents="none"
        style={[
          overscan(holo.travel),
          {
            opacity: holo.sparkle,
            mixBlendMode: 'color-dodge',
            experimental_backgroundImage: SPARKLE,
            transform: [{ translateX: -t.x * holo.travel * 1.6 }],
          },
        ]}
      />
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
      backgroundColor: '#1A1A1C',
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 22,
      elevation: 10,
    },
    image: { width: '100%', height: '100%' },
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

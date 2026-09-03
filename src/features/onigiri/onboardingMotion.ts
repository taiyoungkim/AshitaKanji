// 온보딩 축하 파티클의 결정적 시드 데이터.
// 매 실행마다 같은 패턴을 만들어 디자인 검수와 스크린샷 테스트가 흔들리지 않게 한다.

export const ONBOARDING_CONFETTI_COLORS = ['#FAB815', '#EB4308', '#F164AD'] as const;
export const ONBOARDING_CONFETTI_SEED = 29844943;
export const ONBOARDING_CONFETTI_DELAY_MS = 140;
export const ONBOARDING_CONFETTI_DURATION_MS = 2800;

export interface OnboardingParticle {
  id: number;
  xRatio: number;
  yRatio: number;
  drift: number;
  pop: number;
  fall: number;
  rotation: number;
  width: number;
  height: number;
  delayRatio: number;
  endRatio: number;
  color: (typeof ONBOARDING_CONFETTI_COLORS)[number];
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildOnboardingParticles(
  count = 28,
  seed = ONBOARDING_CONFETTI_SEED,
): OnboardingParticle[] {
  const random = mulberry32(seed);
  return Array.from({ length: count }, (_, id) => {
    const long = random() > 0.48;
    const delayRatio = 0.05 + random() * 0.2;
    return {
      id,
      xRatio: 0.02 + random() * 0.96,
      yRatio: 0.04 + random() * 0.38,
      drift: -42 + random() * 84,
      pop: 8 + random() * 30,
      fall: 150 + random() * 260,
      rotation: (random() > 0.5 ? 1 : -1) * (120 + random() * 420),
      width: long ? 6 + random() * 4 : 7 + random() * 6,
      height: long ? 12 + random() * 7 : 6 + random() * 5,
      delayRatio,
      endRatio: Math.min(0.98, delayRatio + 0.7 + random() * 0.12),
      color: ONBOARDING_CONFETTI_COLORS[Math.floor(random() * ONBOARDING_CONFETTI_COLORS.length)]!,
    };
  });
}

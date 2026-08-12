// 과거 점수 분포 곡선 — 순수 계산만 담는다.
//
// 표본이 적어 히스토그램은 울퉁불퉁하다. Gaussian KDE 로 부드럽게 만들되
// 밀도는 0–1 로 정규화해서 y 축에 절대 의미를 두지 않는다(비교용 형태만 본다).

/** x 축 샘플 간격. 0–100 을 2.5 로 나누면 41개 점이 나온다. */
export const SAMPLE_STEP = 2.5;
export const SAMPLE_COUNT = 41;

/** Gaussian kernel 폭. 점수 표본이 적어 12 정도가 형태를 유지한다. */
export const KDE_BANDWIDTH = 12;

/** 차트 기하 — 화면이 이 값을 그대로 쓴다. */
export const CHART_HEIGHT = 150;
export const PLOT_TOP = 20;
export const PLOT_BOTTOM = 132;
export const PLOT_INSET_X = 8;

export interface DensityPoint {
  /** 0–100 점수. */
  x: number;
  /** 0–1 정규화 밀도. */
  density: number;
}

/** 한 지점의 원시 밀도 — 모든 표본의 Gaussian 기여 합. */
export function rawDensityAt(x: number, samples: readonly number[]): number {
  let sum = 0;
  for (const score of samples) {
    const z = (x - score) / KDE_BANDWIDTH;
    sum += Math.exp(-0.5 * z * z);
  }
  return sum;
}

/**
 * 0–100 구간의 정규화된 밀도 곡선.
 * 표본이 비어 있으면 모든 밀도가 0인 평평한 선을 돌려준다(NaN 을 만들지 않는다).
 */
export function buildDensityCurve(samples: readonly number[]): DensityPoint[] {
  const raw: number[] = [];
  let max = 0;
  for (let i = 0; i < SAMPLE_COUNT; i += 1) {
    const x = i * SAMPLE_STEP;
    const d = rawDensityAt(x, samples);
    raw.push(d);
    if (d > max) max = d;
  }

  return raw.map((d, i) => ({
    x: i * SAMPLE_STEP,
    // max 가 0 이면 표본이 없다는 뜻 — 나누지 않는다.
    density: max > 0 ? d / max : 0,
  }));
}

/** 산술평균. 표본이 없으면 0. */
export function meanScore(samples: readonly number[]): number {
  if (samples.length === 0) return 0;
  return samples.reduce((a, b) => a + b, 0) / samples.length;
}

/**
 * 현재 점수의 백분위 — 나보다 낮은 과거 점수의 비율.
 * 동점은 "앞섰다"에 넣지 않는다.
 */
export function percentileAmong(current: number, samples: readonly number[]): number {
  if (samples.length === 0) return 0;
  const lower = samples.filter((s) => s < current).length;
  return (100 * lower) / samples.length;
}

/** 점수(0–100)를 차트 폭 안의 x 좌표로. */
export function scoreToX(score: number, width: number): number {
  const usable = Math.max(0, width - PLOT_INSET_X * 2);
  const clamped = Math.min(100, Math.max(0, score));
  return PLOT_INSET_X + (clamped / 100) * usable;
}

/** 정규화 밀도(0–1)를 차트 y 좌표로. 밀도가 높을수록 위로 간다. */
export function densityToY(density: number): number {
  const clamped = Math.min(1, Math.max(0, density));
  return PLOT_BOTTOM - clamped * (PLOT_BOTTOM - PLOT_TOP);
}

/**
 * 마커 y 는 곡선과 같은 KDE 를 다시 태워서 구한다.
 * 별도 근사를 쓰면 마커가 선에서 떠 보인다.
 */
export function markerDensity(current: number, samples: readonly number[]): number {
  // 곡선과 **같은 기준**으로 나눠야 마커가 선 위에 앉는다.
  // 표본 위치의 최대로 나누면 표본이 그리드(2.5 간격) 사이에 있을 때 기준이 어긋나
  // 마커가 곡선에서 떠 보인다.
  let gridMax = 0;
  for (let i = 0; i < SAMPLE_COUNT; i += 1) {
    const d = rawDensityAt(i * SAMPLE_STEP, samples);
    if (d > gridMax) gridMax = d;
  }
  if (gridMax <= 0) return 0;
  return Math.min(1, rawDensityAt(current, samples) / gridMax);
}

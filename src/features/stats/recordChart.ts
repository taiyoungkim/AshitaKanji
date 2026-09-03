// 과거 점수 분포 히스토그램 — 순수 계산만 담는다.
//
// 최종 화면(16)은 부드러운 곡선이 아니라 막대다. 표본을 그대로 세고,
// 높이는 최빈 구간 대비 비율로만 준다(y 축에 절대 의미를 두지 않는다).

/** 0–100 을 10 구간으로 나눈다. 최종 화면의 막대 수와 같다. */
export const HISTOGRAM_BINS = 10;

/** 차트 기하 — 화면이 이 값을 그대로 쓴다. */
export const CHART_HEIGHT = 150;
/** "나" 라벨과 점이 앉을 자리. 막대는 이 아래에서만 자란다. */
export const MARKER_HEADROOM = 26;

export interface ScoreBin {
  /** 구간 하한(포함). */
  from: number;
  /** 구간 상한(마지막 구간만 포함). */
  to: number;
  count: number;
  /** 최빈 구간 대비 0–1 높이. 표본이 없으면 0. */
  ratio: number;
}

/**
 * 점수(0–100)가 속한 구간 인덱스. 100 은 마지막 구간에 넣는다 —
 * 그러지 않으면 만점이 차트 밖으로 떨어진다.
 */
export function binIndexFor(score: number): number {
  const clamped = Math.min(100, Math.max(0, score));
  return Math.min(HISTOGRAM_BINS - 1, Math.floor((clamped / 100) * HISTOGRAM_BINS));
}

/** 표본을 구간별로 센 히스토그램. 표본이 비어도 구간 수는 항상 같다. */
export function buildScoreHistogram(samples: readonly number[]): ScoreBin[] {
  const width = 100 / HISTOGRAM_BINS;
  const counts = new Array<number>(HISTOGRAM_BINS).fill(0);
  for (const score of samples) {
    const index = binIndexFor(score);
    counts[index] = (counts[index] ?? 0) + 1;
  }
  const max = Math.max(...counts, 0);

  return counts.map((count, i) => ({
    from: i * width,
    to: (i + 1) * width,
    count,
    // max 가 0 이면 표본이 없다는 뜻 — 나누지 않는다.
    ratio: max > 0 ? count / max : 0,
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

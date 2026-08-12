import { describe, expect, it } from 'vitest';
import {
  buildDensityCurve,
  densityToY,
  markerDensity,
  meanScore,
  percentileAmong,
  PLOT_BOTTOM,
  PLOT_TOP,
  SAMPLE_COUNT,
  SAMPLE_STEP,
  scoreToX,
} from './recordChart';

describe('buildDensityCurve', () => {
  it('0에서 100까지 41개 점을 만든다', () => {
    const curve = buildDensityCurve([50, 60, 70]);
    expect(curve).toHaveLength(SAMPLE_COUNT);
    expect(curve[0]?.x).toBe(0);
    expect(curve[1]?.x).toBe(SAMPLE_STEP);
    expect(curve[curve.length - 1]?.x).toBe(100);
  });

  it('모든 밀도가 0과 1 사이다', () => {
    const curve = buildDensityCurve([12, 44, 91, 91, 60]);
    for (const point of curve) {
      expect(point.density).toBeGreaterThanOrEqual(0);
      expect(point.density).toBeLessThanOrEqual(1);
      expect(Number.isNaN(point.density)).toBe(false);
    }
  });

  it('표본이 모두 같아도 NaN 이 생기지 않는다', () => {
    const curve = buildDensityCurve([80, 80, 80]);
    expect(curve.every((p) => Number.isFinite(p.density))).toBe(true);
    // 표본 위치에서 최대가 된다.
    const peak = curve.reduce((best, p) => (p.density > best.density ? p : best));
    expect(peak.x).toBeCloseTo(80, 0);
  });

  it('극단 점수에서도 안전하다', () => {
    const curve = buildDensityCurve([0, 100]);
    expect(curve.every((p) => Number.isFinite(p.density))).toBe(true);
  });

  it('표본이 없으면 평평한 0 곡선이다', () => {
    const curve = buildDensityCurve([]);
    expect(curve).toHaveLength(SAMPLE_COUNT);
    expect(curve.every((p) => p.density === 0)).toBe(true);
  });
});

describe('meanScore', () => {
  it('산술평균을 낸다', () => {
    expect(meanScore([50, 100])).toBe(75);
  });

  it('표본이 없으면 0이다', () => {
    expect(meanScore([])).toBe(0);
  });
});

describe('percentileAmong', () => {
  it('나보다 낮은 기록의 비율을 낸다', () => {
    expect(percentileAmong(80, [50, 60, 90, 95])).toBe(50);
  });

  it('동점은 앞선 것으로 세지 않는다', () => {
    expect(percentileAmong(60, [60, 60, 60])).toBe(0);
  });

  it('모든 과거보다 높으면 100이다', () => {
    expect(percentileAmong(99, [10, 20, 30])).toBe(100);
  });

  it('표본이 없으면 0이다', () => {
    expect(percentileAmong(70, [])).toBe(0);
  });
});

describe('좌표 변환', () => {
  it('0점과 100점이 inset 안쪽 양 끝에 놓인다', () => {
    const width = 300;
    expect(scoreToX(0, width)).toBe(8);
    expect(scoreToX(100, width)).toBe(292);
  });

  it('범위를 벗어난 점수를 잘라낸다', () => {
    expect(scoreToX(-20, 300)).toBe(scoreToX(0, 300));
    expect(scoreToX(140, 300)).toBe(scoreToX(100, 300));
  });

  it('밀도 0은 바닥, 1은 천장이다', () => {
    expect(densityToY(0)).toBe(PLOT_BOTTOM);
    expect(densityToY(1)).toBe(PLOT_TOP);
  });

  it('y 는 항상 plot 범위 안이다', () => {
    for (const d of [-1, 0, 0.3, 0.77, 1, 2]) {
      const y = densityToY(d);
      expect(y).toBeGreaterThanOrEqual(PLOT_TOP);
      expect(y).toBeLessThanOrEqual(PLOT_BOTTOM);
    }
  });
});

describe('markerDensity', () => {
  it('곡선과 같은 정규화 범위를 쓴다', () => {
    const samples = [40, 55, 70];
    const d = markerDensity(60, samples);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(1);
  });

  it('표본이 없으면 0이다', () => {
    expect(markerDensity(50, [])).toBe(0);
  });

  it('표본 중앙에서 값이 크다', () => {
    const samples = [50, 50, 50];
    expect(markerDensity(50, samples)).toBeCloseTo(1, 5);
    expect(markerDensity(0, samples)).toBeLessThan(0.1);
  });

  // 표본이 그리드(2.5 간격) 사이에 놓이면 정규화 기준이 어긋나 마커가 선에서 떴었다.
  it('그리드 위 모든 점에서 곡선과 같은 값을 낸다', () => {
    for (const samples of [[51.25], [51.25, 63.7], [12.4, 12.6, 88.9]]) {
      const curve = buildDensityCurve(samples);
      for (const point of curve) {
        expect(markerDensity(point.x, samples)).toBeCloseTo(point.density, 10);
      }
    }
  });
});

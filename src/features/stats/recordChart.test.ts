import { describe, expect, it } from 'vitest';
import {
  binIndexFor,
  buildScoreHistogram,
  HISTOGRAM_BINS,
  meanScore,
  percentileAmong,
} from './recordChart';

describe('binIndexFor', () => {
  it('구간 하한은 그 구간에 들어간다', () => {
    expect(binIndexFor(0)).toBe(0);
    expect(binIndexFor(10)).toBe(1);
    expect(binIndexFor(95)).toBe(9);
  });

  it('만점은 마지막 구간에 넣는다', () => {
    expect(binIndexFor(100)).toBe(HISTOGRAM_BINS - 1);
  });

  it('범위를 벗어난 점수는 잘라 넣는다', () => {
    expect(binIndexFor(-20)).toBe(0);
    expect(binIndexFor(140)).toBe(HISTOGRAM_BINS - 1);
  });
});

describe('buildScoreHistogram', () => {
  it('표본과 무관하게 구간 수는 항상 같다', () => {
    expect(buildScoreHistogram([])).toHaveLength(HISTOGRAM_BINS);
    expect(buildScoreHistogram([50])).toHaveLength(HISTOGRAM_BINS);
  });

  it('표본을 구간별로 센다', () => {
    const bins = buildScoreHistogram([5, 8, 52, 100]);
    expect(bins[0]?.count).toBe(2);
    expect(bins[5]?.count).toBe(1);
    expect(bins[9]?.count).toBe(1);
    expect(bins[1]?.count).toBe(0);
  });

  it('높이는 최빈 구간을 1로 두고 나눈다', () => {
    const bins = buildScoreHistogram([5, 8, 52]);
    expect(bins[0]?.ratio).toBe(1);
    expect(bins[5]?.ratio).toBe(0.5);
    expect(bins[1]?.ratio).toBe(0);
  });

  it('표본이 없으면 모든 높이가 0이다 — 0으로 나누지 않는다', () => {
    for (const bin of buildScoreHistogram([])) {
      expect(bin.ratio).toBe(0);
    }
  });

  it('구간 경계는 0에서 100까지 이어진다', () => {
    const bins = buildScoreHistogram([]);
    expect(bins[0]?.from).toBe(0);
    expect(bins.at(-1)?.to).toBe(100);
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

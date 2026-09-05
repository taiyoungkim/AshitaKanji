import { describe, expect, it } from 'vitest';
import { calculateDailyNewAllowance } from './dailyStudyPolicy';

describe('calculateDailyNewAllowance', () => {
  it.each([
    { due: 0, expected: 12 },
    { due: 12, expected: 12 },
    { due: 24, expected: 12 },
    { due: 30, expected: 6 },
    { due: 35, expected: 1 },
    { due: 36, expected: 0 },
    { due: 48, expected: 0 },
  ])('allows $expected new cards when 12-new pace has $due due reviews', ({ due, expected }) => {
    expect(calculateDailyNewAllowance(12, due)).toBe(expected);
  });

  it('normalizes invalid negative inputs', () => {
    expect(calculateDailyNewAllowance(-1, 10)).toBe(0);
    expect(calculateDailyNewAllowance(12, -5)).toBe(12);
  });
});

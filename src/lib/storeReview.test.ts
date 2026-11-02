import { describe, expect, it } from 'vitest';
import { REVIEW_INTERVAL_MS, shouldAskReview } from './storeReview';

describe('별점 요청 간격', () => {
  it('처음엔 요청, 120일 안엔 다시 안 함, 지나면 다시 요청', () => {
    const now = new Date('2026-11-02T09:00:00').getTime();
    expect(shouldAskReview(0, now)).toBe(true);
    expect(shouldAskReview(now, now + REVIEW_INTERVAL_MS - 1)).toBe(false);
    expect(shouldAskReview(now, now + REVIEW_INTERVAL_MS)).toBe(true);
  });
});

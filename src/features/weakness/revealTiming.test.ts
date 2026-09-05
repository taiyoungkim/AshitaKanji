import { describe, expect, it } from 'vitest';
import { measureRevealLatency } from './revealTiming';

describe('measureRevealLatency', () => {
  it('measures from card display to the first reveal', () => {
    expect(measureRevealLatency(1_000, 4_250)).toBe(3_250);
  });

  it('returns null before a card display timestamp exists', () => {
    expect(measureRevealLatency(null, 4_250)).toBeNull();
  });

  it('clamps clock rollback to zero', () => {
    expect(measureRevealLatency(5_000, 4_250)).toBe(0);
  });
});

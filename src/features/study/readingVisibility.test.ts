import { describe, expect, it } from 'vitest';
import { shouldShowReading } from './readingVisibility';

describe('shouldShowReading', () => {
  it('shows the reading before reveal when the setting is enabled', () => {
    expect(shouldShowReading(false, true)).toBe(true);
  });

  it('hides the reading before reveal when the setting is disabled', () => {
    expect(shouldShowReading(false, false)).toBe(false);
  });

  it('always shows the reading after reveal', () => {
    expect(shouldShowReading(true, false)).toBe(true);
  });
});

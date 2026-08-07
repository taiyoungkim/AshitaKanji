import { describe, expect, it } from 'vitest';
import { computeOnigiriProgress } from '~/features/onigiri/progress';
import type { SessionRecord } from '~/types/Session';
import { buildCurrentOrderPresentation } from './currentOrderPresentation';

function sessions(count: number): SessionRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    mode: 'review',
    started_at: index + 1,
    ended_at: index + 2,
    ended_reason: 'completed',
    planned_new: 1,
    planned_review: 0,
    planned_scan: null,
    done_new: 1,
    done_review: 0,
    done_scan: 0,
    again_count: 0,
  }));
}

describe('buildCurrentOrderPresentation', () => {
  it('shows the next ingredient before any reward is earned', () => {
    const entry = computeOnigiriProgress([]).current;

    expect(buildCurrentOrderPresentation(entry, false)).toEqual({
      label: '다음 재료',
      value: 'RICE',
    });
  });

  it('shows the latest ingredient earned for the current onigiri', () => {
    const entry = computeOnigiriProgress(sessions(2)).current;

    expect(buildCurrentOrderPresentation(entry, false)).toEqual({
      label: '최근 획득',
      value: 'SEAWEED',
    });
  });

  it('shows the terminal collection state after every onigiri is completed', () => {
    const snapshot = computeOnigiriProgress(sessions(96));

    expect(buildCurrentOrderPresentation(snapshot.current, true)).toEqual({
      label: '수집 상태',
      value: '모든 오니기리 완성',
    });
  });
});

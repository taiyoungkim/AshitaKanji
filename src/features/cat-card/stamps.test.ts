import { describe, expect, it } from 'vitest';
import type { SessionRecord } from '~/types/Session';
import { earnedStamps } from './stamps';

function session(
  localDate: string,
  hour: number,
  ended_reason: SessionRecord['ended_reason'] = 'completed',
): SessionRecord {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  const at = new Date(y, m - 1, d, hour).getTime();
  return {
    mode: 'new',
    started_at: at,
    ended_at: at,
    ended_reason,
    planned_new: null,
    planned_review: null,
    planned_scan: null,
    done_new: 0,
    done_review: 0,
    done_scan: 0,
    again_count: 0,
  };
}

describe('earnedStamps', () => {
  it('counts one stamp per day with a completed session', () => {
    expect(
      earnedStamps(
        [session('2026-10-01', 9), session('2026-10-01', 21), session('2026-10-02', 8)],
        '2026-10-01',
      ),
    ).toBe(2);
  });

  it('ignores sessions that were not completed', () => {
    expect(
      earnedStamps(
        [session('2026-10-01', 9, 'abandoned'), session('2026-10-02', 9, 'app_killed'), session('2026-10-03', 9)],
        '2026-10-01',
      ),
    ).toBe(1);
  });

  it('only counts days on or after the epoch', () => {
    expect(
      earnedStamps([session('2026-09-30', 23), session('2026-10-01', 0)], '2026-10-01'),
    ).toBe(1);
  });

  it('keeps accumulating across gaps (unlike the streak)', () => {
    expect(
      earnedStamps(
        [session('2026-10-01', 9), session('2026-10-05', 9), session('2026-10-20', 9)],
        '2026-10-01',
      ),
    ).toBe(3);
  });
});

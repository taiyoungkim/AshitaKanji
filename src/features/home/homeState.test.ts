import { describe, expect, it } from 'vitest';
import type { SessionRecord } from '~/types/Session';
import { buildHomeDayState } from './homeState';

const NOW = new Date(2026, 8, 1, 18, 0, 0).getTime();

function session(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 1,
    mode: 'new',
    started_at: NOW - 180_000,
    ended_at: NOW - 60_000,
    ended_reason: 'completed',
    planned_new: 5,
    planned_review: 0,
    planned_scan: null,
    done_new: 5,
    done_review: 0,
    done_scan: 0,
    again_count: 0,
    ...overrides,
  };
}

function build(sessions: SessionRecord[], extra: Partial<Parameters<typeof buildHomeDayState>[0]> = {}) {
  return buildHomeDayState({
    sessions,
    nowMs: NOW,
    remainingStudyCount: 5,
    readingCompleteToday: false,
    ...extra,
  });
}

describe('buildHomeDayState', () => {
  it('shows study before when no regular study was completed today', () => {
    expect(build([]).phase).toBe('studyBefore');
  });

  it('ignores completed sessions from a previous local day', () => {
    const yesterday = new Date(2026, 7, 31, 23, 50, 0).getTime();
    expect(build([session({ started_at: yesterday - 60_000, ended_at: yesterday })]).phase).toBe('studyBefore');
  });

  it('uses the latest regular study session from today', () => {
    const older = session({ id: 1, ended_at: NOW - 600_000, again_count: 4 });
    const latest = session({ id: 2, ended_at: NOW - 60_000, again_count: 0, done_new: 8 });
    expect(build([older, latest])).toMatchObject({ phase: 'noReview', studySessionId: 2, studyCount: 8 });
  });

  it('shows review pending when the study produced again words', () => {
    expect(build([session({ again_count: 3 })])).toMatchObject({ phase: 'reviewPending', againCount: 3 });
  });

  it('shows review done after a completed weakness session', () => {
    const study = session({ again_count: 3, ended_at: NOW - 120_000 });
    const review = session({ id: 2, mode: 'weakness', source_session_id: 1, started_at: NOW - 100_000, ended_at: NOW - 30_000 });
    expect(build([study, review]).phase).toBe('reviewDone');
  });

  it('does not use a weakness session completed before the latest study', () => {
    const review = session({ id: 1, mode: 'weakness', source_session_id: 2, ended_at: NOW - 180_000 });
    const study = session({ id: 2, again_count: 2, ended_at: NOW - 60_000 });
    expect(build([review, study]).phase).toBe('reviewPending');
  });

  it('does not confuse the general weakness mode with today review', () => {
    const study = session({ id: 1, again_count: 2, ended_at: NOW - 120_000 });
    const generalWeakness = session({ id: 2, mode: 'weakness', ended_at: NOW - 30_000 });
    expect(build([study, generalWeakness]).phase).toBe('reviewPending');
  });

  it('shows no-review after a clean study', () => {
    expect(build([session({ again_count: 0 })]).phase).toBe('noReview');
  });

  it('shows all-done only when study and reading work are exhausted', () => {
    expect(build([session()], { remainingStudyCount: 0, readingCompleteToday: true }).phase).toBe('allDone');
    expect(build([], { remainingStudyCount: 0, readingCompleteToday: true }).phase).toBe('allDone');
  });

  it('keeps the study-complete state until a reading chapter is completed today', () => {
    expect(build([session()], { remainingStudyCount: 0, readingCompleteToday: false }).phase).toBe('noReview');
  });

  it('exposes stable study metrics for the hero', () => {
    const result = build([session({ started_at: NOW - 185_500, ended_at: NOW - 5_000, done_new: 4, done_review: 3 })]);
    expect(result).toMatchObject({ studyCount: 7, durationSec: 181 });
  });
});

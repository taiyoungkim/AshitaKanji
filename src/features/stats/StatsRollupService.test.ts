// Design Ref: §8 Test Plan — StatsRollupService.
// 핵심: rollup 은 idempotent (두 번 돌려도 daily_stats 동일).

import { describe, expect, it } from 'vitest';
import { InMemoryCardRepo } from '~/db/repos/memory/InMemoryCardRepo';
import { InMemoryDailyStatsRepo } from '~/db/repos/memory/InMemoryDailyStatsRepo';
import { InMemoryReviewLogRepo } from '~/db/repos/memory/InMemoryReviewLogRepo';
import { InMemorySessionRepo } from '~/db/repos/memory/InMemorySessionRepo';
import { InMemoryUserCardRepo } from '~/db/repos/memory/InMemoryUserCardRepo';
import type { JlptLevel, UserCard, Word } from '~/types/Card';
import type { ReviewLogRecord } from '~/types/ReviewLog';
import type { SessionRecord } from '~/types/Session';
import { Grade } from '~/types/Grade';
import { StatsRollupService, dayKey } from './StatsRollupService';

const day = (y: number, m: number, d: number, h = 10): number =>
  new Date(y, m - 1, d, h).getTime();

function log(partial: Partial<ReviewLogRecord> & { reviewed_at: number }): ReviewLogRecord {
  return {
    word_id: 'w1',
    grade: Grade.Good,
    state_before: 'review',
    state_after: 'review',
    scheduled_days: 1,
    elapsed_days: 1,
    stability_after: 5,
    difficulty_after: 5,
    reveal_ms: 1000,
    session_id: 1,
    ...partial,
  };
}

function session(partial: Partial<SessionRecord> & { started_at: number }): SessionRecord {
  return {
    mode: 'review',
    ended_at: partial.started_at + 60_000,
    ended_reason: 'completed',
    planned_new: null,
    planned_review: null,
    planned_scan: null,
    done_new: 0,
    done_review: 0,
    done_scan: 0,
    again_count: 0,
    ...partial,
  };
}

async function buildService(opts?: {
  logs?: ReviewLogRecord[];
  sessions?: SessionRecord[];
  userCards?: UserCard[];
  wordLevels?: Map<string, JlptLevel>;
  words?: Word[];
}) {
  const logRepo = new InMemoryReviewLogRepo();
  for (const l of opts?.logs ?? []) await logRepo.insert(l);
  const sessionRepo = new InMemorySessionRepo();
  for (const s of opts?.sessions ?? []) await sessionRepo.create(s);
  const dailyRepo = new InMemoryDailyStatsRepo();
  const cardRepo = new InMemoryCardRepo(opts?.words ?? []);
  const userCardRepo = new InMemoryUserCardRepo(opts?.userCards ?? [], opts?.wordLevels);
  const svc = new StatsRollupService(logRepo, sessionRepo, dailyRepo, cardRepo, userCardRepo);
  return { svc, dailyRepo };
}

describe('StatsRollupService.rollup', () => {
  it('is idempotent — running twice yields identical daily_stats', async () => {
    const logs = [
      log({ reviewed_at: day(2026, 5, 20), grade: Grade.Again, state_before: 'new' }),
      log({ reviewed_at: day(2026, 5, 20), grade: Grade.Good }),
      log({ reviewed_at: day(2026, 5, 21), grade: Grade.Easy }),
    ];
    const sessions = [session({ started_at: day(2026, 5, 20) })];
    const { svc, dailyRepo } = await buildService({ logs, sessions });

    await svc.rollup();
    const first = await dailyRepo.findAll();
    await svc.rollup();
    const second = await dailyRepo.findAll();

    expect(second).toEqual(first);
  });

  it('aggregates new/review/again/good_easy correctly per day', async () => {
    const d20 = day(2026, 5, 20);
    const logs = [
      log({ reviewed_at: d20, grade: Grade.Again, state_before: 'new' }), // new + again
      log({ reviewed_at: d20, grade: Grade.Good, state_before: 'review' }), // review + good_easy
      log({ reviewed_at: d20, grade: Grade.Easy, state_before: 'review' }), // review + good_easy
    ];
    const { svc, dailyRepo } = await buildService({ logs });
    await svc.rollup();
    const row = await dailyRepo.findByDate(dayKey(d20));
    expect(row).not.toBeNull();
    expect(row!.new_count).toBe(1);
    expect(row!.review_count).toBe(2);
    expect(row!.again_count).toBe(1);
    expect(row!.good_easy_count).toBe(2);
    expect(row!.avg_reveal_ms).toBe(1000);
  });
});

describe('StatsRollupService.getStreak', () => {
  it('counts consecutive active days ending today', async () => {
    const logs = [
      log({ reviewed_at: day(2026, 5, 18) }),
      log({ reviewed_at: day(2026, 5, 19) }),
      log({ reviewed_at: day(2026, 5, 20) }),
    ];
    const { svc } = await buildService({ logs });
    await svc.rollup();
    expect(await svc.getStreak(day(2026, 5, 20, 23))).toBe(3);
  });

  it('breaks streak on a gap', async () => {
    const logs = [
      log({ reviewed_at: day(2026, 5, 18) }),
      log({ reviewed_at: day(2026, 5, 20) }), // 19일 비어 끊김
    ];
    const { svc } = await buildService({ logs });
    await svc.rollup();
    expect(await svc.getStreak(day(2026, 5, 20, 23))).toBe(1);
  });
});

describe('StatsRollupService.getLevelProgress', () => {
  it('counts mature cards (stability>=21) by level vs total', async () => {
    const words: Word[] = [
      { id: 'a', level: 'N5', surface: '亜', reading_kana: 'あ', meaning_ko: '', card_type: 'A', qa_status: 'verified', deprecated: 0, data_version: 1 },
      { id: 'b', level: 'N5', surface: '位', reading_kana: 'い', meaning_ko: '', card_type: 'A', qa_status: 'verified', deprecated: 0, data_version: 1 },
      { id: 'c', level: 'N4', surface: '宇', reading_kana: 'う', meaning_ko: '', card_type: 'A', qa_status: 'verified', deprecated: 0, data_version: 1 },
    ];
    const wordLevels = new Map<string, JlptLevel>([
      ['a', 'N5'],
      ['b', 'N5'],
      ['c', 'N4'],
    ]);
    const userCards: UserCard[] = [
      { word_id: 'a', difficulty: 5, stability: 30, scheduled_days: 30, elapsed_days: 0, reps: 5, lapses: 0, last_review: 0, due: 0, state: 'review', leech: 0 }, // mature
      { word_id: 'b', difficulty: 5, stability: 10, scheduled_days: 10, elapsed_days: 0, reps: 2, lapses: 0, last_review: 0, due: 0, state: 'review', leech: 0 }, // 미성숙
    ];
    const { svc } = await buildService({ words, userCards, wordLevels });
    const progress = await svc.getLevelProgress();
    const n5 = progress.find((p) => p.level === 'N5')!;
    const n4 = progress.find((p) => p.level === 'N4')!;
    expect(n5.total).toBe(2);
    expect(n5.mature).toBe(1);
    expect(n4.total).toBe(1);
    expect(n4.mature).toBe(0);
  });
});

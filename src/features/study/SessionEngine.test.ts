// Design Ref: §4.2 / §8 Test Plan — SessionEngine 단위 테스트
// 검증: 큐 우선순위(overdue→신규), 완료 전환, Again 처리, 카운터.

import { beforeEach, describe, expect, it } from 'vitest';
import { generatorParameters } from 'ts-fsrs';
import type { JlptLevel, Word } from '~/types/Card';
import { Grade } from '~/types/Grade';
import { FsrsScheduler } from '~/srs/FsrsScheduler';
import { InMemoryCardRepo } from '~/db/repos/memory/InMemoryCardRepo';
import { InMemoryUserCardRepo } from '~/db/repos/memory/InMemoryUserCardRepo';
import { InMemoryReviewLogRepo } from '~/db/repos/memory/InMemoryReviewLogRepo';
import { InMemorySessionRepo } from '~/db/repos/memory/InMemorySessionRepo';
import { SessionEngine } from './SessionEngine';
import type { ReviewWriter } from '~/db/repos/ReviewWriter';
import { RepositoryReviewWriter } from '~/db/repos/ReviewWriter';

const NOW = Date.UTC(2026, 0, 10, 0, 0, 0);
const DAY = 86_400_000;

function word(id: string, level: JlptLevel = 'N5'): Word {
  return {
    id, level, surface: id, reading_kana: 'x', meaning_ko: 'x',
    card_type: 'A', qa_status: 'verified', deprecated: 0, data_version: 1,
  };
}

let cardRepo: InMemoryCardRepo;
let userCardRepo: InMemoryUserCardRepo;
let logRepo: InMemoryReviewLogRepo;
let sessionRepo: InMemorySessionRepo;
let fsrs: FsrsScheduler;
let engine: SessionEngine;

beforeEach(() => {
  userCardRepo = new InMemoryUserCardRepo();
  cardRepo = new InMemoryCardRepo([], (wordId) => userCardRepo.has(wordId));
  logRepo = new InMemoryReviewLogRepo();
  sessionRepo = new InMemorySessionRepo();
  fsrs = new FsrsScheduler(generatorParameters({
    enable_fuzz: false,
    enable_short_term: false,
  }));
  // 항등 셔플 주입 — 큐 순서 검증을 결정적으로 유지 (런타임은 랜덤 셔플).
  engine = new SessionEngine(cardRepo, userCardRepo, logRepo, sessionRepo, fsrs, (items) => [
    ...items,
  ]);
});

const cfg = { levels: ['N5'] as JlptLevel[], dailyNewLimit: 3, highIntensityAcknowledged: false };

describe('start — queue build', () => {
  it('keeps four days of Good-only daily study from accumulating into 48 reviews', async () => {
    cardRepo.seed(Array.from({ length: 48 }, (_, i) => word(`w${i}`)));
    const dailyCounts: number[] = [];

    for (let day = 0; day < 4; day += 1) {
      const now = NOW + day * DAY;
      const dailyEngine = new SessionEngine(
        cardRepo,
        userCardRepo,
        logRepo,
        sessionRepo,
        new FsrsScheduler(),
        (items) => [...items],
      );
      const session = await dailyEngine.start({ ...cfg, dailyNewLimit: 12 }, now);
      dailyCounts.push(session.mainQueue.length);
      while (dailyEngine.current()) {
        await dailyEngine.submitGrade(Grade.Good, 500, now);
      }
    }

    expect(dailyCounts[0]).toBe(12);
    expect(dailyCounts[1]).toBe(12);
    expect(Math.max(...dailyCounts)).toBeLessThanOrEqual(24);
  });

  it('keeps mixed Again/Good reviews ahead of new cards and suppresses new after a long gap', async () => {
    cardRepo.seed(Array.from({ length: 120 }, (_, index) => word(`mixed-${index}`)));
    const studyDays = [0, 1, 2, 3, 33];

    for (const day of studyDays) {
      const now = NOW + day * DAY;
      const dailyEngine = new SessionEngine(
        cardRepo,
        userCardRepo,
        logRepo,
        sessionRepo,
        fsrs,
        (items) => [...items],
      );
      const session = await dailyEngine.start({ ...cfg, dailyNewLimit: 12 }, now);
      const reviewCount = session.mainQueue.filter(
        (card) => card.userCard?.state !== 'new',
      ).length;
      const ids = session.mainQueue.map((card) => card.word.id);

      expect(new Set(ids).size).toBe(ids.length);
      expect(
        session.mainQueue.slice(0, reviewCount).every(
          (card) => card.userCard?.state !== 'new',
        ),
      ).toBe(true);
      expect(
        session.mainQueue.slice(reviewCount).every(
          (card) => card.userCard?.state === 'new',
        ),
      ).toBe(true);

      if (day === 33) {
        expect(reviewCount).toBeGreaterThanOrEqual(36);
        expect(session.mainQueue).toHaveLength(reviewCount);
      }

      let newIndex = 0;
      while (dailyEngine.current()) {
        const current = dailyEngine.current()!;
        const isNew = current.userCard?.state === 'new';
        const grade = isNew && newIndex++ % 4 === 0 ? Grade.Again : Grade.Good;
        await dailyEngine.submitGrade(grade, 500, now);
      }
    }
  });

  it('orders all active overdue reviews before new cards from selected levels', async () => {
    cardRepo.seed([
      word('due1'),
      word('due2'),
      word('due-n4', 'N4'),
      word('new1'),
      word('new2'),
      word('new-n4', 'N4'),
    ]);
    // due cards: 미리 review 상태 + 과거 due
    const r1 = { ...fsrs.initNew('due1', NOW - 5 * DAY), state: 'review' as const, due: NOW - 2 * DAY };
    const r2 = { ...fsrs.initNew('due2', NOW - 5 * DAY), state: 'review' as const, due: NOW - 1 * DAY };
    const r3 = { ...fsrs.initNew('due-n4', NOW - 5 * DAY), state: 'review' as const, due: NOW - 12 * 60 * 60 * 1000 };
    await userCardRepo.upsert(r1);
    await userCardRepo.upsert(r2);
    await userCardRepo.upsert(r3);

    const s = await engine.start(cfg, NOW);
    const ids = s.mainQueue.map((c) => c.word.id);
    // overdue 먼저 (due 오름차순: due1(-2d) < due2(-1d)), 이어 신규
    expect(ids.slice(0, 2)).toEqual(['due1', 'due2']);
    expect(ids).toContain('due-n4'); // 해제한 레벨이어도 기존 due는 유지
    expect(ids).toContain('new1');
    expect(ids).not.toContain('new-n4'); // 레벨 선택은 신규에만 적용
    expect(s.phase).toBe('main');
  });

  it('limits new cards to dailyNewLimit', async () => {
    cardRepo.seed([word('a'), word('b'), word('c'), word('d'), word('e')]);
    const s = await engine.start(cfg, NOW);
    expect(s.mainQueue).toHaveLength(3);
  });

  it('serves overdue reviews first and reduces new cards when backlog exceeds the budget', async () => {
    const reviews = Array.from({ length: 30 }, (_, i) => word(`review-${i}`));
    const fresh = Array.from({ length: 12 }, (_, i) => word(`new-${i}`));
    cardRepo.seed([...reviews, ...fresh]);
    for (let i = 0; i < reviews.length; i += 1) {
      await userCardRepo.upsert({
        ...fsrs.initNew(reviews[i]!.id, NOW - 40 * DAY),
        state: 'review',
        due: NOW - (reviews.length - i) * DAY,
      });
    }

    const session = await engine.start({ ...cfg, dailyNewLimit: 12 }, NOW);

    expect(session.mainQueue).toHaveLength(36);
    expect(session.mainQueue.slice(0, 30).every((card) => card.userCard?.state === 'review')).toBe(true);
    expect(session.mainQueue.slice(30).every((card) => card.userCard?.state === 'new')).toBe(true);
    const record = await sessionRepo.findById(session.sessionId);
    expect(record).toMatchObject({ planned_review: 30, planned_new: 6 });
  });

  it('keeps N1-only new cards exclusive to words first classified as N1', async () => {
    cardRepo.seed([
      word('n1-a', 'N1'),
      word('n5-a', 'N5'),
      word('n4-a', 'N4'),
      word('n2-a', 'N2'),
      word('n1-b', 'N1'),
    ]);

    const s = await engine.start(
      { ...cfg, levels: ['N1'], dailyNewLimit: 10 },
      NOW,
    );

    expect(s.mainQueue.map((card) => card.word.id)).toEqual(['n1-a', 'n1-b']);
    expect(s.mainQueue.every((card) => card.word.level === 'N1')).toBe(true);
  });

  it('does not queue deprecated review cards', async () => {
    cardRepo.seed([{ ...word('old-pattern'), surface: '～区', deprecated: 1 }]);
    await userCardRepo.upsert({
      ...fsrs.initNew('old-pattern', NOW - 5 * DAY),
      state: 'review',
      due: NOW - DAY,
    });

    const s = await engine.start(cfg, NOW);
    expect(s.mainQueue.map((c) => c.word.id)).not.toContain('old-pattern');
    expect(s.phase).toBe('done');
  });

  it('starts in done phase when no due and no new cards (empty queue)', async () => {
    cardRepo.seed([]); // 데이터 없음
    const s = await engine.start(cfg, NOW);
    expect(s.mainQueue).toHaveLength(0);
    expect(s.phase).toBe('done');
    expect(engine.current()).toBeNull();
    expect(engine.isRoundComplete()).toBe(true);
  });
});

describe('submitGrade — counters + persistence', () => {
  it('does not advance the in-memory session when atomic persistence fails', async () => {
    cardRepo.seed([word('a')]);
    const failingWriter: ReviewWriter = {
      save: async () => {
        throw new Error('transaction failed');
      },
    };
    const failingEngine = new SessionEngine(
      cardRepo,
      userCardRepo,
      logRepo,
      sessionRepo,
      fsrs,
      (items) => [...items],
      failingWriter,
    );
    await failingEngine.start({ ...cfg, dailyNewLimit: 1 }, NOW);

    await expect(failingEngine.submitGrade(Grade.Good, 500, NOW)).rejects.toThrow(
      'transaction failed',
    );
    expect(failingEngine.current()?.word.id).toBe('a');
    expect(failingEngine.snapshot().doneNew).toBe(0);
    expect(await userCardRepo.findById('a')).toBeNull();
    expect(logRepo.all()).toHaveLength(0);
  });

  it('retries the same card once after a transient persistence failure without duplicate logs', async () => {
    cardRepo.seed([word('retry')]);
    const fallback = new RepositoryReviewWriter(userCardRepo, logRepo);
    let attempts = 0;
    const flakyWriter: ReviewWriter = {
      save: async (card, log) => {
        attempts += 1;
        if (attempts === 1) throw new Error('temporary write failure');
        return fallback.save(card, log);
      },
    };
    const retryEngine = new SessionEngine(
      cardRepo,
      userCardRepo,
      logRepo,
      sessionRepo,
      fsrs,
      (items) => [...items],
      flakyWriter,
    );
    await retryEngine.start({ ...cfg, dailyNewLimit: 1 }, NOW);

    await expect(retryEngine.submitGrade(Grade.Good, 500, NOW)).rejects.toThrow(
      'temporary write failure',
    );
    await retryEngine.submitGrade(Grade.Good, 500, NOW);

    expect(retryEngine.current()).toBeNull();
    expect(retryEngine.snapshot().doneNew).toBe(1);
    expect(logRepo.all()).toHaveLength(1);
    expect((await userCardRepo.findById('retry'))?.reps).toBe(1);
  });

  it('logs and upserts, counts new vs review', async () => {
    cardRepo.seed([word('a'), word('b')]);
    await engine.start({ ...cfg, dailyNewLimit: 2 }, NOW);
    await engine.submitGrade(Grade.Good, 1200, NOW);
    await engine.submitGrade(Grade.Easy, 800, NOW);
    const snap = engine.snapshot();
    expect(snap.doneNew).toBe(2);
    expect(snap.doneReview).toBe(0);
    expect(logRepo.all()).toHaveLength(2);
    expect(logRepo.all()[0]!.session_id).toBe(snap.sessionId);
    expect(logRepo.all()[0]!.reveal_ms).toBe(1200);
    expect(await userCardRepo.findById('a')).not.toBeNull();
  });
});

describe('Again — daily-only scheduling', () => {
  it('does not requeue a new card in the same session and schedules its next due', async () => {
    cardRepo.seed([word('a')]);
    await engine.start({ ...cfg, dailyNewLimit: 1 }, NOW);
    await engine.submitGrade(Grade.Again, 500, NOW);

    expect(engine.current()).toBeNull();
    expect(engine.isRoundComplete()).toBe(true);
    const stored = await userCardRepo.findById('a');
    expect(stored?.state).toBe('review');
    expect(stored?.due).toBeGreaterThanOrEqual(NOW + DAY);
  });
});

describe('completeCurrentRound — no surprise review loop', () => {
  it('marks the session done after the planned queue is exhausted, even with Again cards', async () => {
    cardRepo.seed([word('a')]);
    await engine.start({ ...cfg, dailyNewLimit: 1 }, NOW);
    await engine.submitGrade(Grade.Again, 500, NOW);

    expect(engine.isRoundComplete()).toBe(true);
    engine.completeCurrentRound();

    const snap = engine.snapshot();
    expect(snap.phase).toBe('done');
    expect(engine.current()).toBeNull();
  });
});

describe('end — summary', () => {
  it('returns counts and updates session record', async () => {
    cardRepo.seed([word('a'), word('b')]);
    await engine.start({ ...cfg, dailyNewLimit: 2 }, NOW);
    await engine.submitGrade(Grade.Again, 500, NOW);
    await engine.submitGrade(Grade.Good, 500, NOW);
    const summary = await engine.end('completed', NOW + 60_000);
    expect(summary.newCount).toBe(2);
    expect(summary.againCount).toBe(1);
    expect(summary.goodEasyCount).toBe(1);
    expect(summary.durationSec).toBe(60);
    const rec = await sessionRepo.findById(summary.sessionId);
    expect(rec?.ended_reason).toBe('completed');
    expect(rec?.again_count).toBe(1);
  });
});

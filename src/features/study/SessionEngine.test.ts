// Design Ref: §4.2 / §8 Test Plan — SessionEngine 단위 테스트
// 검증: 큐 우선순위(overdue→신규), Again 미니라운드, 2회 실패→내일(재큐 X), 카운터.

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
  cardRepo = new InMemoryCardRepo();
  userCardRepo = new InMemoryUserCardRepo();
  logRepo = new InMemoryReviewLogRepo();
  sessionRepo = new InMemorySessionRepo();
  fsrs = new FsrsScheduler(generatorParameters({ enable_fuzz: false }));
  // 항등 셔플 주입 — 큐 순서 검증을 결정적으로 유지 (런타임은 랜덤 셔플).
  engine = new SessionEngine(cardRepo, userCardRepo, logRepo, sessionRepo, fsrs, (items) => [
    ...items,
  ]);
});

const cfg = { levels: ['N5'] as JlptLevel[], dailyNewLimit: 3, highIntensityAcknowledged: false };

describe('start — queue build', () => {
  it('orders overdue reviews before new cards, level-filtered', async () => {
    cardRepo.seed([word('due1'), word('due2'), word('new1'), word('new2'), word('n4', 'N4')]);
    // due cards: 미리 review 상태 + 과거 due
    const r1 = { ...fsrs.initNew('due1', NOW - 5 * DAY), state: 'review' as const, due: NOW - 2 * DAY };
    const r2 = { ...fsrs.initNew('due2', NOW - 5 * DAY), state: 'review' as const, due: NOW - 1 * DAY };
    await userCardRepo.upsert(r1);
    await userCardRepo.upsert(r2);

    const s = await engine.start(cfg, NOW);
    const ids = s.mainQueue.map((c) => c.word.id);
    // overdue 먼저 (due 오름차순: due1(-2d) < due2(-1d)), 이어 신규
    expect(ids.slice(0, 2)).toEqual(['due1', 'due2']);
    expect(ids).toContain('new1');
    expect(ids).not.toContain('n4'); // 레벨 필터
    expect(s.phase).toBe('main');
  });

  it('limits new cards to dailyNewLimit', async () => {
    cardRepo.seed([word('a'), word('b'), word('c'), word('d'), word('e')]);
    const s = await engine.start(cfg, NOW);
    expect(s.mainQueue).toHaveLength(3);
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

describe('Again mini-round + 2회 실패 → 내일로', () => {
  it('moves main-round Again cards into again round', async () => {
    cardRepo.seed([word('a'), word('b')]);
    await engine.start({ ...cfg, dailyNewLimit: 2 }, NOW);
    await engine.submitGrade(Grade.Again, 500, NOW); // a → pendingAgain
    await engine.submitGrade(Grade.Good, 500, NOW);  // b
    expect(engine.isRoundComplete()).toBe(true);
    await engine.startAgainRound();
    const snap = engine.snapshot();
    expect(snap.phase).toBe('again');
    expect(snap.againQueue.map((c) => c.word.id)).toEqual(['a']);
  });

  it('after 2 Again in again-round, card is NOT requeued (deferred to tomorrow)', async () => {
    cardRepo.seed([word('a')]);
    await engine.start({ ...cfg, dailyNewLimit: 1 }, NOW);
    await engine.submitGrade(Grade.Again, 500, NOW); // count 1 (main)
    await engine.startAgainRound();
    expect(engine.current()?.word.id).toBe('a');
    await engine.submitGrade(Grade.Again, 500, NOW); // count 2 → defer, no requeue
    expect(engine.snapshot().againSubmissions.get('a')).toBe(2);
    expect(engine.isRoundComplete()).toBe(true); // 재큐 안 됨
  });

  it('skips again round when no Again submitted', async () => {
    cardRepo.seed([word('a')]);
    await engine.start({ ...cfg, dailyNewLimit: 1 }, NOW);
    await engine.submitGrade(Grade.Good, 500, NOW);
    await engine.startAgainRound();
    expect(engine.snapshot().phase).toBe('done');
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

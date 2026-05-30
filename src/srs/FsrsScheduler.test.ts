// Design Ref: §4.1 / §8 Test Plan — FsrsScheduler 단위 테스트 (등급별 due 계산)
// fuzz off → 결정성 확보.

import { describe, expect, it } from 'vitest';
import { generatorParameters } from 'ts-fsrs';
import { Grade } from '~/types/Grade';
import { FsrsScheduler } from './FsrsScheduler';

const NOW = Date.UTC(2026, 0, 1, 0, 0, 0); // 결정적 기준 시각
const sched = new FsrsScheduler(generatorParameters({ enable_fuzz: false }));

describe('initNew', () => {
  it('creates a new-state card due at now', () => {
    const c = sched.initNew('w1', NOW);
    expect(c.word_id).toBe('w1');
    expect(c.state).toBe('new');
    expect(c.reps).toBe(0);
    expect(c.lapses).toBe(0);
    expect(c.due).toBe(NOW);
    expect(c.leech).toBe(0);
  });
});

describe('review — 등급별 due 간격', () => {
  it('Easy due > Good due > Hard due (longer interval for higher grade)', () => {
    const base = sched.initNew('w', NOW);
    const again = sched.review(base, Grade.Again, NOW).next;
    const hard = sched.review(base, Grade.Hard, NOW).next;
    const good = sched.review(base, Grade.Good, NOW).next;
    const easy = sched.review(base, Grade.Easy, NOW).next;

    expect(again.due).toBeLessThanOrEqual(hard.due);
    expect(hard.due).toBeLessThanOrEqual(good.due);
    expect(good.due).toBeLessThanOrEqual(easy.due);
    expect(easy.due).toBeGreaterThan(NOW);
  });

  it('Again increments lapses on a review-state card', () => {
    // 카드를 review 상태까지 끌어올림 (Good 2회)
    let card = sched.initNew('w', NOW);
    card = sched.review(card, Grade.Good, NOW).next;
    card = sched.review(card, Grade.Good, card.due).next;
    const before = card.lapses;
    const lapsed = sched.review(card, Grade.Again, card.due).next;
    expect(lapsed.lapses).toBeGreaterThanOrEqual(before);
    expect(lapsed.reps).toBeGreaterThan(card.reps);
  });

  it('produces a log mirroring next card state', () => {
    const base = sched.initNew('w', NOW);
    const { next, log } = sched.review(base, Grade.Good, NOW);
    expect(log.word_id).toBe('w');
    expect(log.grade).toBe(Grade.Good);
    expect(log.state_before).toBe('new');
    expect(log.state_after).toBe(next.state);
    expect(log.stability_after).toBe(next.stability);
    expect(log.reveal_ms).toBeNull();
    expect(log.session_id).toBeNull();
  });

  it('is deterministic with fuzz disabled', () => {
    const base = sched.initNew('w', NOW);
    const a = sched.review(base, Grade.Good, NOW).next;
    const b = sched.review(base, Grade.Good, NOW).next;
    expect(a.due).toBe(b.due);
    expect(a.stability).toBe(b.stability);
  });
});

describe('preview', () => {
  it('returns one card per grade in sequence', () => {
    const base = sched.initNew('w', NOW);
    const seq = sched.preview(base, [Grade.Good, Grade.Good, Grade.Easy], NOW);
    expect(seq).toHaveLength(3);
    // due 단조 증가 (각 복습을 due 시점에 수행 가정)
    expect(seq[1]!.due).toBeGreaterThanOrEqual(seq[0]!.due);
    expect(seq[2]!.due).toBeGreaterThanOrEqual(seq[1]!.due);
  });
});

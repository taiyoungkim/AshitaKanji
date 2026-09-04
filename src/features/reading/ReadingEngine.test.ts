// 회독 엔진 — 청크 로드 / 랜덤 순서 / 모름 진행 / 모름0 완료 / 재개 단위 테스트.
// 순서가 랜덤이라 테스트는 하드코딩된 id 대신 실제 큐를 따라간다.

import { beforeEach, describe, expect, it } from 'vitest';
import type { JlptLevel, Word } from '~/types/Card';
import { InMemoryCardRepo } from '~/db/repos/memory/InMemoryCardRepo';
import { InMemoryReadingProgressRepo } from '~/db/repos/memory/InMemoryReadingProgressRepo';
import { ReadingEngine } from './ReadingEngine';

function w(id: string, freq: number, chapter = 1, level: JlptLevel = 'N5'): Word {
  return {
    id,
    level,
    surface: id,
    reading_kana: 'x',
    meaning_ko: 'x',
    card_type: 'A',
    qa_status: 'verified',
    deprecated: 0,
    data_version: 0,
    frequency: freq,
    reading_chapter: chapter,
  };
}

// ch1: a b c (순서는 엔진이 랜덤화한다)
const WORDS = [w('c', 3.0), w('a', 5.0), w('b', 4.0), w('z', 9.0, 2)];

let cards: InMemoryCardRepo;
let progress: InMemoryReadingProgressRepo;
let engine: ReadingEngine;

beforeEach(() => {
  cards = new InMemoryCardRepo(WORDS);
  progress = new InMemoryReadingProgressRepo(WORDS);
  engine = new ReadingEngine(cards, progress);
});

describe('ReadingEngine.startChapter', () => {
  it('loads the chapter block (order randomized)', async () => {
    const s = await engine.startChapter('N5', 1);
    expect(s.queue.map((x) => x.id).sort()).toEqual(['a', 'b', 'c']);
    expect(s.current?.id).toBe(s.queue[0]?.id);
    expect(s.total).toBe(3);
    expect(s.covered).toBe(0);
    expect(s.known).toBe(0);
    expect(s.phase).toBe('study');
  });

  it('chapter N contains only its independent word block', async () => {
    const s = await engine.startChapter('N5', 2);
    expect(s.queue.map((x) => x.id)).toEqual(['z']);
    expect(s.total).toBe(1);
  });

  it('known in one chapter does not carry to another (per-회차)', async () => {
    await engine.startChapter('N5', 1);
    await engine.mark(true); // a known @ chapter 1
    const s2 = await engine.startChapter('N5', 2); // chapter 2 fresh
    expect(s2.queue.map((x) => x.id)).toEqual(['z']);
    expect(s2.known).toBe(0);
  });
});

describe('mark (패스 기반)', () => {
  it('모름도 재큐 없이 진행 (passDone 증가)', async () => {
    const first = await engine.startChapter('N5', 1);
    const order = first.queue.map((x) => x.id);
    let s = await engine.mark(false); // 첫 단어 모름 → 그냥 진행
    expect(s.current?.id).toBe(order[1]);
    expect(s.passDone).toBe(1);
    expect(s.wrong).toBe(1);
    expect(s.covered).toBe(1);
    expect(s.known).toBe(0);
    s = await engine.mark(true); // 두 번째 안다
    expect(s.current?.id).toBe(order[2]);
    expect(s.known).toBe(1);
    expect(s.passDone).toBe(2);
    expect(s.covered).toBe(2);
  });

  it('모름이 남아도 큐를 다 돌면 회독 1회 완료(done)', async () => {
    await engine.startChapter('N5', 1);
    await engine.mark(true);
    await engine.mark(false); // 모름 — 그 자리에서 다시 돌리지 않는다
    const s = await engine.mark(true); // 큐 소진
    expect(s.phase).toBe('done');
    expect(s.known).toBe(2);
    expect(s.total).toBe(3);
  });

  it('전부 안다면 done', async () => {
    await engine.startChapter('N5', 1);
    await engine.mark(true);
    await engine.mark(true);
    const s = await engine.mark(true);
    expect(s.phase).toBe('done');
    expect(s.known).toBe(3);
  });

  it('다음 회독은 모름 단어만 다시 (안다 제외)', async () => {
    const first = await engine.startChapter('N5', 1);
    const order = first.queue.map((x) => x.id);
    await engine.mark(true); // 첫 단어 안다
    await engine.mark(false); // 모름
    await engine.mark(false); // 모름 → 회독 종료
    const s = await engine.startChapter('N5', 1); // 다시 회독
    expect(s.queue.map((x) => x.id).sort()).toEqual([order[1]!, order[2]!].sort()); // 안다 제외
    expect(s.passTotal).toBe(2);
    expect(s.phase).toBe('study');
    expect(s.covered).toBe(3);
  });

  it('repeated exposure does not increase coverage twice', async () => {
    await engine.startChapter('N5', 1);
    await engine.mark(false);
    await engine.mark(true);
    await engine.mark(true);
    const secondPass = await engine.startChapter('N5', 1);
    expect(secondPass.covered).toBe(3);
    const afterRepeat = await engine.mark(false);
    expect(afterRepeat.covered).toBe(3);
  });
});

describe('resume', () => {
  it('persisted known words are excluded on restart', async () => {
    const first = await engine.startChapter('N5', 1);
    const order = first.queue.map((x) => x.id);
    await engine.mark(true); // 첫 단어 persisted known
    // 새 엔진(앱 재시작 모사) — 같은 progress repo
    const engine2 = new ReadingEngine(cards, progress);
    const s = await engine2.startChapter('N5', 1);
    expect(s.queue.map((x) => x.id).sort()).toEqual([order[1]!, order[2]!].sort());
    expect(s.known).toBe(1);
    expect(s.covered).toBe(1);
  });

  it('unknown exposure persists as coverage without becoming mastered', async () => {
    const first = await engine.startChapter('N5', 1);
    const marked = first.current!.id;
    await engine.mark(false);
    const engine2 = new ReadingEngine(cards, progress);
    const s = await engine2.startChapter('N5', 1);
    expect(s.covered).toBe(1);
    expect(s.known).toBe(0);
    expect(s.queue.map((x) => x.id)).toContain(marked);
  });

  // 재진입 시 방금 모름 처리한 단어부터 다시 시작하지 않는다 (안 본 단어 먼저).
  it('resumes with an unseen word after leaving mid-pass', async () => {
    const first = await engine.startChapter('N5', 1);
    const marked = first.current!.id;
    await engine.mark(false);
    const engine2 = new ReadingEngine(cards, progress);
    const s = await engine2.startChapter('N5', 1);
    expect(s.current?.id).not.toBe(marked);
    expect(s.queue[s.queue.length - 1]?.id).toBe(marked);
  });

  it('fully-known chapter starts as done', async () => {
    await progress.recordExposure('a', 1, true);
    await progress.recordExposure('b', 1, true);
    await progress.recordExposure('c', 1, true);
    const s = await engine.startChapter('N5', 1);
    expect(s.phase).toBe('done');
    expect(s.known).toBe(3);
  });
});

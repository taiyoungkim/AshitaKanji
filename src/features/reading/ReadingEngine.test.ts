// 회독 엔진 — 청크 로드 / 모름 재큐 / 모름0 완료 / 재개 단위 테스트.

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

// ch1: a(5.0) b(4.0) c(3.0) — 빈도 내림차순
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
  it('loads chapter words in frequency desc order', async () => {
    const s = await engine.startChapter('N5', 1);
    expect(s.queue.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(s.current?.id).toBe('a');
    expect(s.total).toBe(3);
    expect(s.known).toBe(0);
    expect(s.phase).toBe('study');
  });

  it('chapter N is cumulative (reading_chapter<=N), freq desc', async () => {
    const s = await engine.startChapter('N5', 2); // a,b,c (ch1) + z (ch2)
    expect(s.queue.map((x) => x.id)).toEqual(['z', 'a', 'b', 'c']);
    expect(s.total).toBe(4);
  });

  it('known in one chapter does not carry to another (per-회차)', async () => {
    await engine.startChapter('N5', 1);
    await engine.mark(true); // a known @ chapter 1
    const s2 = await engine.startChapter('N5', 2); // chapter 2 fresh
    expect(s2.queue.map((x) => x.id)).toEqual(['z', 'a', 'b', 'c']);
    expect(s2.known).toBe(0);
  });
});

describe('mark (패스 기반)', () => {
  it('모름도 재큐 없이 진행 (passDone 증가)', async () => {
    await engine.startChapter('N5', 1); // [a,b,c]
    let s = await engine.mark(false); // a 모름 → 그냥 진행
    expect(s.current?.id).toBe('b');
    expect(s.passDone).toBe(1);
    expect(s.wrong).toBe(1);
    expect(s.known).toBe(0);
    s = await engine.mark(true); // b 안다
    expect(s.current?.id).toBe('c');
    expect(s.known).toBe(1);
    expect(s.passDone).toBe(2);
  });

  it('패스 끝 + 모름 남으면 passEnd', async () => {
    await engine.startChapter('N5', 1);
    await engine.mark(true); // a
    await engine.mark(false); // b 모름
    const s = await engine.mark(true); // c → 큐 소진, b 미숙 남음
    expect(s.phase).toBe('passEnd');
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

  it('reshuffle = 남은 미숙(틀린 것)만 새 패스', async () => {
    await engine.startChapter('N5', 1);
    await engine.mark(true); // a 안다
    await engine.mark(false); // b 모름
    await engine.mark(false); // c 모름 → passEnd
    const s = await engine.reshuffle();
    expect(s.queue.map((x) => x.id).sort()).toEqual(['b', 'c']); // a 제외
    expect(s.passTotal).toBe(2);
    expect(s.phase).toBe('study');
  });
});

describe('resume', () => {
  it('persisted known words are excluded on restart', async () => {
    await engine.startChapter('N5', 1);
    await engine.mark(true); // a persisted known
    // 새 엔진(앱 재시작 모사) — 같은 progress repo
    const engine2 = new ReadingEngine(cards, progress);
    const s = await engine2.startChapter('N5', 1);
    expect(s.queue.map((x) => x.id)).toEqual(['b', 'c']);
    expect(s.known).toBe(1);
  });

  it('fully-known chapter starts as done', async () => {
    await progress.setKnown('a', 1, true);
    await progress.setKnown('b', 1, true);
    await progress.setKnown('c', 1, true);
    const s = await engine.startChapter('N5', 1);
    expect(s.phase).toBe('done');
    expect(s.known).toBe(3);
  });
});

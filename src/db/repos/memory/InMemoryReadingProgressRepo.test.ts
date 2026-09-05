// 회독 진행 저장소 + 챕터 상태 파생 단위 테스트.

import { describe, expect, it } from 'vitest';
import type { JlptLevel, Word } from '~/types/Card';
import { chapterStatus, isChapterComplete, pickCurrentChapter, resolveCurrentChapter } from '~/types/Reading';
import { InMemoryReadingProgressRepo } from './InMemoryReadingProgressRepo';

function w(id: string, chapter: number, level: JlptLevel = 'N5'): Word {
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
    reading_chapter: chapter,
  };
}

// 독립 블록 ch1: a,b · ch2: c,d
const pool = () => new InMemoryReadingProgressRepo([w('a', 1), w('b', 1), w('c', 2), w('d', 2)]);

describe('InMemoryReadingProgressRepo (독립 챕터)', () => {
  it('returns only the selected chapter and separates seen from known', async () => {
    const r = pool();
    const k1 = await r.getChapterProgress('N5', 1);
    expect([...k1.keys()].sort()).toEqual(['a', 'b']); // 누적 챕터1
    await r.recordExposure('a', 1, false);
    expect((await r.getChapterProgress('N5', 1)).get('a')).toEqual({ seen: true, known: false });
    const k2 = await r.getChapterProgress('N5', 2);
    expect([...k2.keys()].sort()).toEqual(['c', 'd']);
  });

  it('reports independent total, coverage, and mastery', async () => {
    const r = pool();
    await r.recordExposure('a', 1, false);
    await r.recordExposure('c', 2, true);
    const stats = await r.getLevelChapterStats('N5');
    expect(stats).toEqual([
      { level: 'N5', chapter: 1, total: 2, covered: 1, known: 0 },
      { level: 'N5', chapter: 2, total: 2, covered: 1, known: 1 },
    ]);
  });

  it('resetChapter resets mastery but preserves coverage', async () => {
    const r = pool();
    await r.recordExposure('a', 1, true);
    await r.resetChapter('N5', 1);
    const stats = await r.getLevelChapterStats('N5');
    expect(stats.find((s) => s.chapter === 1)).toMatchObject({ covered: 1, known: 0 });
  });
});

describe('chapter status helpers', () => {
  it('isChapterComplete needs all known', () => {
    expect(isChapterComplete({ level: 'N5', chapter: 1, total: 2, covered: 2, known: 2 })).toBe(true);
    expect(isChapterComplete({ level: 'N5', chapter: 1, total: 2, covered: 2, known: 1 })).toBe(false);
    expect(isChapterComplete({ level: 'N5', chapter: 1, total: 0, covered: 0, known: 0 })).toBe(false);
  });

  it('sequential unlock: completed → inProgress → locked', () => {
    const stats = [
      { level: 'N5' as const, chapter: 1, total: 2, covered: 2, known: 2 }, // done
      { level: 'N5' as const, chapter: 2, total: 2, covered: 2, known: 1 }, // current
      { level: 'N5' as const, chapter: 3, total: 2, covered: 0, known: 0 }, // locked
    ];
    expect(chapterStatus(stats, 1)).toBe('completed');
    expect(chapterStatus(stats, 2)).toBe('inProgress');
    expect(chapterStatus(stats, 3)).toBe('locked');
  });
});

describe('pickCurrentChapter', () => {
  const stat = (chapter: number, known: number, total = 2) => ({
    level: 'N5' as const,
    chapter,
    total,
    covered: total,
    known,
  });

  it('첫 미완료 챕터를 준다', () => {
    expect(pickCurrentChapter([stat(1, 2), stat(2, 1), stat(3, 0)])?.chapter).toBe(2);
  });

  it('입력 순서가 뒤섞여도 챕터 번호 순으로 고른다', () => {
    expect(pickCurrentChapter([stat(3, 0), stat(1, 2), stat(2, 1)])?.chapter).toBe(2);
  });

  it('전부 완료면 마지막 챕터를 준다 — 다시 외우기 대상', () => {
    expect(pickCurrentChapter([stat(1, 2), stat(2, 2)])?.chapter).toBe(2);
  });

  it('챕터가 없으면 null 이다', () => {
    expect(pickCurrentChapter([])).toBeNull();
  });
});

describe('resolveCurrentChapter', () => {
  const stat = (chapter: number, known: number, total = 2) => ({
    level: 'N5' as const,
    chapter,
    total,
    covered: total,
    known,
  });

  it('기억한 챕터가 미완료면 그 챕터를 이어서 연다', () => {
    expect(resolveCurrentChapter([stat(1, 1), stat(2, 0), stat(3, 0)], 2)?.chapter).toBe(2);
  });

  it('기억한 챕터를 끝냈으면 첫 미완료 챕터로 넘어간다', () => {
    expect(resolveCurrentChapter([stat(1, 2), stat(2, 1)], 1)?.chapter).toBe(2);
  });

  it('기억이 없거나 목록에 없는 챕터면 첫 미완료 챕터를 준다', () => {
    expect(resolveCurrentChapter([stat(1, 2), stat(2, 1)], undefined)?.chapter).toBe(2);
    expect(resolveCurrentChapter([stat(1, 2), stat(2, 1)], 9)?.chapter).toBe(2);
  });
});

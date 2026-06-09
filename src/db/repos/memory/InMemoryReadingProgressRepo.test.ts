// 회독 진행 저장소 + 챕터 상태 파생 단위 테스트.

import { describe, expect, it } from 'vitest';
import type { JlptLevel, Word } from '~/types/Card';
import { chapterStatus, isChapterComplete } from '~/types/Reading';
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

// 블록 ch1: a,b · ch2: c,d  → 누적: 챕터1=a,b(2), 챕터2=a,b,c,d(4)
const pool = () => new InMemoryReadingProgressRepo([w('a', 1), w('b', 1), w('c', 2), w('d', 2)]);

describe('InMemoryReadingProgressRepo (누적/회차)', () => {
  it('getChapterKnown: 챕터N은 누적 단어, known은 그 회차 한정', async () => {
    const r = pool();
    const k1 = await r.getChapterKnown('N5', 1);
    expect([...k1.keys()].sort()).toEqual(['a', 'b']); // 누적 챕터1
    await r.setKnown('a', 1, true);
    expect((await r.getChapterKnown('N5', 1)).get('a')).toBe(true);
    // 챕터2는 누적 4단어, a는 회차2에선 아직 미숙
    const k2 = await r.getChapterKnown('N5', 2);
    expect([...k2.keys()].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(k2.get('a')).toBe(false);
  });

  it('getLevelChapterStats: total 누적, known 회차별', async () => {
    const r = pool();
    await r.setKnown('a', 1, true); // 회차1 known 1
    await r.setKnown('a', 2, true); // 회차2 known
    await r.setKnown('c', 2, true);
    const stats = await r.getLevelChapterStats('N5');
    expect(stats).toEqual([
      { level: 'N5', chapter: 1, total: 2, known: 1 },
      { level: 'N5', chapter: 2, total: 4, known: 2 },
    ]);
  });

  it('resetChapter: 해당 회차만 초기화', async () => {
    const r = pool();
    await r.setKnown('a', 1, true);
    await r.setKnown('a', 2, true);
    await r.resetChapter('N5', 2);
    const stats = await r.getLevelChapterStats('N5');
    expect(stats.find((s) => s.chapter === 1)?.known).toBe(1);
    expect(stats.find((s) => s.chapter === 2)?.known).toBe(0);
  });
});

describe('chapter status helpers', () => {
  it('isChapterComplete needs all known', () => {
    expect(isChapterComplete({ level: 'N5', chapter: 1, total: 2, known: 2 })).toBe(true);
    expect(isChapterComplete({ level: 'N5', chapter: 1, total: 2, known: 1 })).toBe(false);
    expect(isChapterComplete({ level: 'N5', chapter: 1, total: 0, known: 0 })).toBe(false);
  });

  it('sequential unlock: completed → inProgress → locked', () => {
    const stats = [
      { level: 'N5' as const, chapter: 1, total: 2, known: 2 }, // done
      { level: 'N5' as const, chapter: 2, total: 2, known: 1 }, // current
      { level: 'N5' as const, chapter: 3, total: 2, known: 0 }, // locked
    ];
    expect(chapterStatus(stats, 1)).toBe('completed');
    expect(chapterStatus(stats, 2)).toBe('inProgress');
    expect(chapterStatus(stats, 3)).toBe('locked');
  });
});

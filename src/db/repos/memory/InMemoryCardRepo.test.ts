// CardRepo 필터 규약 단위 테스트 (InMemory 더블) — SQLite 구현과 동일 계약.
// SC: findNewCandidates/countByLevel 는 deprecated 제외 + qa_status='verified' 만.

import { describe, expect, it } from 'vitest';
import type { JlptLevel, Word } from '~/types/Card';
import { InMemoryCardRepo } from './InMemoryCardRepo';

function w(id: string, level: JlptLevel, over: Partial<Word> = {}): Word {
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
    ...over,
  };
}

const repo = () =>
  new InMemoryCardRepo([
    w('a', 'N5'),
    w('b', 'N5'),
    w('c', 'N5', { deprecated: 1 }),
    w('d', 'N5', { qa_status: 'needs_review' }),
    w('e', 'N4'),
  ]);

describe('InMemoryCardRepo.findNewCandidates', () => {
  it('excludes deprecated and non-verified rows', async () => {
    const r = await repo().findNewCandidates(['N5'], 10, []);
    expect(r.map((x) => x.id).sort()).toEqual(['a', 'b']);
  });
  it('honours level filter and excludeWordIds', async () => {
    const r = await repo().findNewCandidates(['N5'], 10, ['a']);
    expect(r.map((x) => x.id)).toEqual(['b']);
  });
  it('respects limit', async () => {
    const r = await repo().findNewCandidates(['N5', 'N4'], 1, []);
    expect(r).toHaveLength(1);
  });
});

describe('InMemoryCardRepo.countByLevel', () => {
  it('counts only active verified', async () => {
    expect(await repo().countByLevel('N5')).toBe(2);
    expect(await repo().countByLevel('N4')).toBe(1);
    expect(await repo().countByLevel('N3')).toBe(0);
  });
});

describe('InMemoryCardRepo.findById / findByIds', () => {
  it('returns row or null', async () => {
    expect((await repo().findById('a'))?.id).toBe('a');
    expect(await repo().findById('zzz')).toBeNull();
  });
  it('findByIds returns matching set (incl. deprecated)', async () => {
    const r = await repo().findByIds(['a', 'c', 'zzz']);
    expect(r.map((x) => x.id).sort()).toEqual(['a', 'c']);
  });
});

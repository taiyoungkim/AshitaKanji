// Design Ref: §8 Test Plan — In-memory test double for CardRepo.

import type { JlptLevel, Word } from '~/types/Card';
import type { CardRepo } from '../CardRepo';

export class InMemoryCardRepo implements CardRepo {
  constructor(private words: Word[] = []) {}

  seed(words: Word[]): void {
    this.words = words;
  }

  async findById(id: string): Promise<Word | null> {
    return this.words.find((w) => w.id === id) ?? null;
  }

  async findByIds(ids: string[]): Promise<Word[]> {
    const set = new Set(ids);
    return this.words.filter((w) => set.has(w.id));
  }

  async findNewCandidates(
    levels: JlptLevel[],
    limit: number,
    excludeWordIds: string[],
  ): Promise<Word[]> {
    const exclude = new Set(excludeWordIds);
    const lv = new Set(levels);
    return this.words
      .filter(
        (w) =>
          lv.has(w.level) &&
          w.deprecated === 0 &&
          w.qa_status === 'verified' &&
          !exclude.has(w.id),
      )
      .slice(0, limit);
  }

  async countByLevel(level: JlptLevel): Promise<number> {
    return this.words.filter(
      (w) => w.level === level && w.deprecated === 0 && w.qa_status === 'verified',
    ).length;
  }

  async findScanCandidates(levels: JlptLevel[], limit: number): Promise<Word[]> {
    const lv = new Set(levels);
    const pool = this.words.filter(
      (w) => lv.has(w.level) && w.deprecated === 0 && w.qa_status === 'verified',
    );
    // 결정적 테스트를 위해 셔플 없이 앞에서 자름 (Sqlite는 RANDOM()).
    return pool.slice(0, limit);
  }

  async findThroughChapter(level: JlptLevel, chapter: number): Promise<Word[]> {
    return this.words
      .filter(
        (w) =>
          w.level === level &&
          w.reading_chapter != null &&
          w.reading_chapter <= chapter &&
          w.deprecated === 0 &&
          w.qa_status === 'verified',
      )
      .sort((a, b) => (b.frequency ?? 0) - (a.frequency ?? 0) || a.id.localeCompare(b.id));
  }
}

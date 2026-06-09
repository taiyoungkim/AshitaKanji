// In-memory test double — 누적 회독. known 키 = `${word_id}\t${chapter}` (회차별 독립).

import type { JlptLevel, Word } from '~/types/Card';
import type { ChapterStat } from '~/types/Reading';
import type { ReadingProgressRepo } from '../ReadingProgressRepo';

export class InMemoryReadingProgressRepo implements ReadingProgressRepo {
  private known = new Map<string, boolean>(); // `${wordId}\t${chapter}` → known

  constructor(private words: Word[] = []) {}

  seed(words: Word[]): void {
    this.words = words;
  }

  private cumulativeWords(level: JlptLevel, chapter: number): Word[] {
    return this.words.filter(
      (w) =>
        w.level === level &&
        w.deprecated === 0 &&
        w.reading_chapter != null &&
        w.reading_chapter <= chapter,
    );
  }

  async getChapterKnown(level: JlptLevel, chapter: number): Promise<Map<string, boolean>> {
    const out = new Map<string, boolean>();
    for (const w of this.cumulativeWords(level, chapter)) {
      out.set(w.id, this.known.get(`${w.id}\t${chapter}`) ?? false);
    }
    return out;
  }

  async setKnown(wordId: string, chapter: number, known: boolean): Promise<void> {
    this.known.set(`${wordId}\t${chapter}`, known);
  }

  async getLevelChapterStats(level: JlptLevel): Promise<ChapterStat[]> {
    const blockCount = new Map<number, number>();
    for (const w of this.words) {
      if (w.level !== level || w.deprecated !== 0 || w.reading_chapter == null) continue;
      blockCount.set(w.reading_chapter, (blockCount.get(w.reading_chapter) ?? 0) + 1);
    }
    const chapters = [...blockCount.keys()].sort((a, b) => a - b);
    const stats: ChapterStat[] = [];
    let cumulative = 0;
    for (const ch of chapters) {
      cumulative += blockCount.get(ch) ?? 0;
      let known = 0;
      for (const w of this.cumulativeWords(level, ch)) {
        if (this.known.get(`${w.id}\t${ch}`)) known += 1;
      }
      stats.push({ level, chapter: ch, total: cumulative, known });
    }
    return stats;
  }

  async resetChapter(level: JlptLevel, chapter: number): Promise<void> {
    for (const w of this.cumulativeWords(level, chapter)) {
      this.known.delete(`${w.id}\t${chapter}`);
    }
  }
}

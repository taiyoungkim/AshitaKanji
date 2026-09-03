// In-memory test double — 독립 챕터별 노출/숙련 상태.

import type { JlptLevel, Word } from '~/types/Card';
import type { ChapterStat } from '~/types/Reading';
import type { ReadingProgressRepo, ReadingWordProgress } from '../ReadingProgressRepo';

export class InMemoryReadingProgressRepo implements ReadingProgressRepo {
  private progress = new Map<string, ReadingWordProgress>();

  constructor(private words: Word[] = []) {}

  seed(words: Word[]): void {
    this.words = words;
  }

  private chapterWords(level: JlptLevel, chapter: number): Word[] {
    return this.words.filter(
      (w) =>
        w.level === level &&
        w.deprecated === 0 &&
        w.reading_chapter != null &&
        w.reading_chapter === chapter,
    );
  }

  async getChapterProgress(level: JlptLevel, chapter: number): Promise<Map<string, ReadingWordProgress>> {
    const out = new Map<string, ReadingWordProgress>();
    for (const w of this.chapterWords(level, chapter)) {
      out.set(w.id, { ...(this.progress.get(`${w.id}\t${chapter}`) ?? { seen: false, known: false }) });
    }
    return out;
  }

  async recordExposure(wordId: string, chapter: number, known: boolean): Promise<void> {
    const key = `${wordId}\t${chapter}`;
    const current = this.progress.get(key);
    this.progress.set(key, { seen: true, known: Boolean(current?.known || known) });
  }

  async getLevelChapterStats(level: JlptLevel): Promise<ChapterStat[]> {
    const blockCount = new Map<number, number>();
    for (const w of this.words) {
      if (w.level !== level || w.deprecated !== 0 || w.reading_chapter == null) continue;
      blockCount.set(w.reading_chapter, (blockCount.get(w.reading_chapter) ?? 0) + 1);
    }
    const chapters = [...blockCount.keys()].sort((a, b) => a - b);
    const stats: ChapterStat[] = [];
    for (const ch of chapters) {
      let covered = 0;
      let known = 0;
      for (const w of this.chapterWords(level, ch)) {
        const item = this.progress.get(`${w.id}\t${ch}`);
        if (item?.seen) covered += 1;
        if (item?.known) known += 1;
      }
      stats.push({ level, chapter: ch, total: blockCount.get(ch) ?? 0, covered, known });
    }
    return stats;
  }

  async resetChapter(level: JlptLevel, chapter: number): Promise<void> {
    for (const w of this.chapterWords(level, chapter)) {
      const key = `${w.id}\t${chapter}`;
      const item = this.progress.get(key);
      if (item) this.progress.set(key, { ...item, known: false });
    }
  }
}

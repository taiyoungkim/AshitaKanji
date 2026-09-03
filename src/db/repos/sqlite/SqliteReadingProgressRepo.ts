// 읽기 진행 SQLite 구현 — 독립 챕터 블록에서 seen(노출)과 known(숙련)을 분리한다.

import type { SQLiteDatabase } from 'expo-sqlite';
import type { JlptLevel } from '~/types/Card';
import type { ChapterStat } from '~/types/Reading';
import type { ReadingProgressRepo, ReadingWordProgress } from '../ReadingProgressRepo';

export class SqliteReadingProgressRepo implements ReadingProgressRepo {
  constructor(private readonly db: SQLiteDatabase) {}

  async getChapterProgress(level: JlptLevel, chapter: number): Promise<Map<string, ReadingWordProgress>> {
    const rows = await this.db.getAllAsync<{ word_id: string; seen: number; known: number }>(
      `SELECT w.id AS word_id, COALESCE(rp.seen, 0) AS seen, COALESCE(rp.known, 0) AS known
       FROM word w
       LEFT JOIN reading_progress rp ON rp.word_id = w.id AND rp.chapter = ?
       WHERE w.level = ? AND w.reading_chapter = ?
         AND w.deprecated = 0`,
      [chapter, level, chapter],
    );
    return new Map(rows.map((r) => [r.word_id, { seen: r.seen === 1, known: r.known === 1 }]));
  }

  async recordExposure(
    wordId: string,
    chapter: number,
    known: boolean,
    now: number = Date.now(),
  ): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO reading_progress (word_id, chapter, known, seen, updated_at)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(word_id, chapter) DO UPDATE SET
         seen = 1,
         known = MAX(reading_progress.known, excluded.known),
         updated_at = excluded.updated_at`,
      [wordId, chapter, known ? 1 : 0, now],
    );
  }

  async getLevelChapterStats(level: JlptLevel): Promise<ChapterStat[]> {
    const blocks = await this.db.getAllAsync<{ chapter: number; count: number }>(
      `SELECT reading_chapter AS chapter, COUNT(*) AS count
       FROM word
       WHERE level = ? AND deprecated = 0 AND reading_chapter IS NOT NULL
       GROUP BY reading_chapter
       ORDER BY reading_chapter`,
      [level],
    );
    const progressRows = await this.db.getAllAsync<{ chapter: number; covered: number; known: number; last_updated_at: number | null }>(
      `SELECT rp.chapter AS chapter,
              SUM(CASE WHEN rp.seen = 1 THEN 1 ELSE 0 END) AS covered,
              SUM(CASE WHEN rp.known = 1 THEN 1 ELSE 0 END) AS known,
              MAX(rp.updated_at) AS last_updated_at
       FROM reading_progress rp
       JOIN word w ON w.id = rp.word_id
       WHERE w.level = ? AND w.deprecated = 0 AND w.reading_chapter = rp.chapter
       GROUP BY rp.chapter`,
      [level],
    );
    const progressByChapter = new Map(progressRows.map((r) => [r.chapter, r]));

    return blocks.map((b) => {
      const progress = progressByChapter.get(b.chapter);
      return {
        level,
        chapter: b.chapter,
        total: b.count,
        covered: progress?.covered ?? 0,
        known: progress?.known ?? 0,
        ...(progress?.last_updated_at != null ? { lastUpdatedAt: progress.last_updated_at } : {}),
      };
    });
  }

  async resetChapter(level: JlptLevel, chapter: number): Promise<void> {
    await this.db.runAsync(
      `UPDATE reading_progress SET known = 0, updated_at = ?
       WHERE chapter = ?
         AND word_id IN (
           SELECT id FROM word
           WHERE level = ? AND reading_chapter = ? AND deprecated = 0
         )`,
      [Date.now(), chapter, level, chapter],
    );
  }
}

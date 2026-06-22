// 누적 회독 진행 SQLite 구현.
//   - 챕터 N 대상 = reading_chapter<=N 단어 전체 (회차마다 재테스트).
//   - known 은 (word_id, chapter) 단위 — 회차별 독립.

import type { SQLiteDatabase } from 'expo-sqlite';
import type { JlptLevel } from '~/types/Card';
import type { ChapterStat } from '~/types/Reading';
import type { ReadingProgressRepo } from '../ReadingProgressRepo';

export class SqliteReadingProgressRepo implements ReadingProgressRepo {
  constructor(private readonly db: SQLiteDatabase) {}

  async getChapterKnown(level: JlptLevel, chapter: number): Promise<Map<string, boolean>> {
    const rows = await this.db.getAllAsync<{ word_id: string; known: number }>(
      `SELECT w.id AS word_id, COALESCE(rp.known, 0) AS known
       FROM word w
       LEFT JOIN reading_progress rp ON rp.word_id = w.id AND rp.chapter = ?
       WHERE w.level = ? AND w.reading_chapter IS NOT NULL AND w.reading_chapter <= ?
         AND w.deprecated = 0`,
      [chapter, level, chapter],
    );
    return new Map(rows.map((r) => [r.word_id, r.known === 1]));
  }

  async setKnown(
    wordId: string,
    chapter: number,
    known: boolean,
    now: number = Date.now(),
  ): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO reading_progress (word_id, chapter, known, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(word_id, chapter) DO UPDATE SET known = excluded.known, updated_at = excluded.updated_at`,
      [wordId, chapter, known ? 1 : 0, now],
    );
  }

  async getLevelChapterStats(level: JlptLevel): Promise<ChapterStat[]> {
    // 블록별 단어 수 → 누적 total
    const blocks = await this.db.getAllAsync<{ chapter: number; count: number }>(
      `SELECT reading_chapter AS chapter, COUNT(*) AS count
       FROM word
       WHERE level = ? AND deprecated = 0 AND reading_chapter IS NOT NULL
       GROUP BY reading_chapter
       ORDER BY reading_chapter`,
      [level],
    );
    // 회차별 known 수 (그 회차에 속한 누적 단어 중 known=1)
    const knownRows = await this.db.getAllAsync<{ chapter: number; known: number }>(
      `SELECT rp.chapter AS chapter, COUNT(*) AS known
       FROM reading_progress rp
       JOIN word w ON w.id = rp.word_id
       WHERE w.level = ? AND w.deprecated = 0 AND rp.known = 1
         AND w.reading_chapter IS NOT NULL AND w.reading_chapter <= rp.chapter
       GROUP BY rp.chapter`,
      [level],
    );
    const knownByChapter = new Map(knownRows.map((r) => [r.chapter, r.known]));

    const stats: ChapterStat[] = [];
    let cumulative = 0;
    for (const b of blocks) {
      cumulative += b.count;
      stats.push({
        level,
        chapter: b.chapter,
        total: cumulative,
        known: knownByChapter.get(b.chapter) ?? 0,
      });
    }
    return stats;
  }

  async resetChapter(level: JlptLevel, chapter: number): Promise<void> {
    await this.db.runAsync(
      `DELETE FROM reading_progress
       WHERE chapter = ?
         AND word_id IN (
           SELECT id FROM word
           WHERE level = ? AND reading_chapter IS NOT NULL AND reading_chapter <= ? AND deprecated = 0
         )`,
      [chapter, level, chapter],
    );
  }
}

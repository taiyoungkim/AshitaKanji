// Design Ref: §3.2 Repository — word 테이블 SQLite 구현.
// Service는 CardRepo interface에만 의존 (InMemory ↔ Sqlite 교체).

import type { SQLiteDatabase } from 'expo-sqlite';
import type { JlptLevel, Word } from '~/types/Card';
import type { CardRepo } from '../CardRepo';
import { rowToWord, type WordRow } from './rowMap';

/** SQL IN (?, ?, ...) placeholder 생성. */
function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(',');
}

export class SqliteCardRepo implements CardRepo {
  constructor(private readonly db: SQLiteDatabase) {}

  async findById(id: string): Promise<Word | null> {
    const row = await this.db.getFirstAsync<WordRow>(
      `SELECT * FROM word WHERE id = ?`,
      [id],
    );
    return row ? rowToWord(row) : null;
  }

  async findChapter(level: JlptLevel, chapter: number): Promise<Word[]> {
    const rows = await this.db.getAllAsync<WordRow>(
      `SELECT * FROM word
       WHERE level = ? AND reading_chapter = ?
         AND deprecated = 0 AND qa_status = 'verified'
       ORDER BY frequency DESC, id ASC`,
      [level, chapter],
    );
    return rows.map(rowToWord);
  }

  async findByIds(ids: string[]): Promise<Word[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.getAllAsync<WordRow>(
      `SELECT * FROM word WHERE id IN (${placeholders(ids.length)})`,
      ids,
    );
    return rows.map(rowToWord);
  }

  async findNewCandidates(
    levels: JlptLevel[],
    limit: number,
  ): Promise<Word[]> {
    if (levels.length === 0 || limit <= 0) return [];
    // user_card 미보유 여부는 DB의 NOT EXISTS 하나로 판정한다. 전체 기존 ID를
    // NOT IN 바인딩하지 않아 카드 수가 늘어도 SQLite 변수 제한에 닿지 않는다.
    const levelPh = placeholders(levels.length);

    const rows = await this.db.getAllAsync<WordRow>(
      `SELECT w.* FROM word w
       WHERE w.level IN (${levelPh})
         AND w.deprecated = 0
         AND w.qa_status = 'verified'
         AND NOT EXISTS (SELECT 1 FROM user_card uc WHERE uc.word_id = w.id)
       ORDER BY w.id
       LIMIT ?`,
      [...levels, limit],
    );
    return rows.map(rowToWord);
  }

  async countByLevel(level: JlptLevel): Promise<number> {
    const row = await this.db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM word
       WHERE level = ? AND deprecated = 0 AND qa_status = 'verified'`,
      [level],
    );
    return row?.n ?? 0;
  }

  async findScanCandidates(levels: JlptLevel[], limit: number): Promise<Word[]> {
    if (levels.length === 0 || limit <= 0) return [];
    const rows = await this.db.getAllAsync<WordRow>(
      `SELECT w.* FROM word w
       WHERE w.level IN (${placeholders(levels.length)})
         AND w.deprecated = 0
         AND w.qa_status = 'verified'
       ORDER BY RANDOM()
       LIMIT ?`,
      [...levels, limit],
    );
    return rows.map(rowToWord);
  }
}

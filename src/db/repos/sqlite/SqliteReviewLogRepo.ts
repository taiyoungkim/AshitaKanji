// Design Ref: §3.2 / §3 review_log — SQLite 구현 (등급 이력).

import type { SQLiteDatabase } from 'expo-sqlite';
import type { CardState } from '~/types/Card';
import type { Grade } from '~/types/Grade';
import type { ReviewLogRecord } from '~/types/ReviewLog';
import type { ReviewLogRepo } from '../ReviewLogRepo';

interface ReviewLogRow {
  id: number;
  word_id: string;
  reviewed_at: number;
  grade: number;
  state_before: string | null;
  state_after: string;
  scheduled_days: number;
  elapsed_days: number;
  stability_after: number;
  difficulty_after: number;
  reveal_ms: number | null;
  session_id: number | null;
}

function rowToLog(r: ReviewLogRow): ReviewLogRecord {
  return {
    id: r.id,
    word_id: r.word_id,
    reviewed_at: r.reviewed_at,
    grade: r.grade as Grade,
    state_before: (r.state_before as CardState | null) ?? null,
    state_after: r.state_after as CardState,
    scheduled_days: r.scheduled_days,
    elapsed_days: r.elapsed_days,
    stability_after: r.stability_after,
    difficulty_after: r.difficulty_after,
    reveal_ms: r.reveal_ms,
    session_id: r.session_id,
  };
}

export class SqliteReviewLogRepo implements ReviewLogRepo {
  constructor(private readonly db: SQLiteDatabase) {}

  async insert(log: ReviewLogRecord): Promise<number> {
    const res = await this.db.runAsync(
      `INSERT INTO review_log
        (word_id, reviewed_at, grade, state_before, state_after,
         scheduled_days, elapsed_days, stability_after, difficulty_after,
         reveal_ms, session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.word_id,
        log.reviewed_at,
        log.grade,
        log.state_before ?? null,
        log.state_after,
        log.scheduled_days,
        log.elapsed_days,
        log.stability_after,
        log.difficulty_after,
        log.reveal_ms ?? null,
        log.session_id ?? null,
      ],
    );
    return res.lastInsertRowId;
  }

  async findBySession(sessionId: number): Promise<ReviewLogRecord[]> {
    const rows = await this.db.getAllAsync<ReviewLogRow>(
      `SELECT * FROM review_log WHERE session_id = ? ORDER BY id ASC`,
      [sessionId],
    );
    return rows.map(rowToLog);
  }

  async findAll(): Promise<ReviewLogRecord[]> {
    const rows = await this.db.getAllAsync<ReviewLogRow>(
      `SELECT * FROM review_log ORDER BY reviewed_at ASC`,
    );
    return rows.map(rowToLog);
  }

  async findSince(sinceMs: number): Promise<ReviewLogRecord[]> {
    const rows = await this.db.getAllAsync<ReviewLogRow>(
      `SELECT * FROM review_log WHERE reviewed_at >= ? ORDER BY reviewed_at ASC`,
      [sinceMs],
    );
    return rows.map(rowToLog);
  }
}

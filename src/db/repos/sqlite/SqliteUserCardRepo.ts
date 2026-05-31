// Design Ref: §3.2 Repository — user_card 테이블 SQLite 구현.
// Plan SC: user_card 절대 손실 X → upsert(INSERT OR REPLACE) only, DROP 없음.

import type { SQLiteDatabase } from 'expo-sqlite';
import type { CardState, JlptLevel, UserCard } from '~/types/Card';
import { MATURE_STABILITY_DAYS, type UserCardRepo } from '../UserCardRepo';

interface UserCardRow {
  word_id: string;
  difficulty: number;
  stability: number;
  scheduled_days: number;
  elapsed_days: number;
  reps: number;
  lapses: number;
  last_review: number;
  due: number;
  state: string;
  note: string | null;
  leech: number;
}

function rowToUserCard(r: UserCardRow): UserCard {
  return {
    word_id: r.word_id,
    difficulty: r.difficulty,
    stability: r.stability,
    scheduled_days: r.scheduled_days,
    elapsed_days: r.elapsed_days,
    reps: r.reps,
    lapses: r.lapses,
    last_review: r.last_review,
    due: r.due,
    state: r.state as CardState,
    note: r.note,
    leech: r.leech === 1 ? 1 : 0,
  };
}

export class SqliteUserCardRepo implements UserCardRepo {
  constructor(private readonly db: SQLiteDatabase) {}

  async findById(wordId: string): Promise<UserCard | null> {
    const row = await this.db.getFirstAsync<UserCardRow>(
      `SELECT * FROM user_card WHERE word_id = ?`,
      [wordId],
    );
    return row ? rowToUserCard(row) : null;
  }

  async findAllDue(nowMs: number): Promise<UserCard[]> {
    const rows = await this.db.getAllAsync<UserCardRow>(
      `SELECT * FROM user_card
       WHERE state != 'new' AND due <= ?
       ORDER BY due ASC`,
      [nowMs],
    );
    return rows.map(rowToUserCard);
  }

  async existingWordIds(): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ word_id: string }>(
      `SELECT word_id FROM user_card`,
    );
    return rows.map((r) => r.word_id);
  }

  async upsert(card: UserCard): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO user_card
        (word_id, difficulty, stability, scheduled_days, elapsed_days,
         reps, lapses, last_review, due, state, note, leech)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(word_id) DO UPDATE SET
         difficulty = excluded.difficulty,
         stability = excluded.stability,
         scheduled_days = excluded.scheduled_days,
         elapsed_days = excluded.elapsed_days,
         reps = excluded.reps,
         lapses = excluded.lapses,
         last_review = excluded.last_review,
         due = excluded.due,
         state = excluded.state,
         note = excluded.note,
         leech = CASE WHEN user_card.leech = 1 THEN 1 ELSE excluded.leech END`,
      [
        card.word_id,
        card.difficulty,
        card.stability,
        card.scheduled_days,
        card.elapsed_days,
        card.reps,
        card.lapses,
        card.last_review,
        card.due,
        card.state,
        card.note ?? null,
        card.leech,
      ],
    );
  }

  async markLeech(wordId: string): Promise<void> {
    await this.db.runAsync(`UPDATE user_card SET leech = 1 WHERE word_id = ?`, [
      wordId,
    ]);
  }

  async countByState(state: CardState): Promise<number> {
    const row = await this.db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM user_card WHERE state = ?`,
      [state],
    );
    return row?.n ?? 0;
  }

  async countMatureByLevel(level: JlptLevel): Promise<number> {
    const row = await this.db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n
       FROM user_card uc JOIN word w ON w.id = uc.word_id
       WHERE w.level = ? AND uc.stability >= ?`,
      [level, MATURE_STABILITY_DAYS],
    );
    return row?.n ?? 0;
  }

  async countStudiedByLevel(level: JlptLevel): Promise<number> {
    const row = await this.db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n
       FROM user_card uc JOIN word w ON w.id = uc.word_id
       WHERE w.level = ?`,
      [level],
    );
    return row?.n ?? 0;
  }

  async findLeeches(): Promise<UserCard[]> {
    const rows = await this.db.getAllAsync<UserCardRow>(
      `SELECT * FROM user_card WHERE leech = 1 ORDER BY due ASC`,
    );
    return rows.map(rowToUserCard);
  }

  async findAll(): Promise<UserCard[]> {
    const rows = await this.db.getAllAsync<UserCardRow>(
      `SELECT * FROM user_card ORDER BY word_id ASC`,
    );
    return rows.map(rowToUserCard);
  }
}

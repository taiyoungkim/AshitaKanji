import { describe, expect, it } from 'vitest';
import type { SQLiteDatabase, SQLiteRunResult } from 'expo-sqlite';
import { Grade } from '~/types/Grade';
import type { UserCard } from '~/types/Card';
import type { ReviewLogRecord } from '~/types/ReviewLog';
import { SqliteReviewWriter } from './SqliteReviewWriter';

const { DatabaseSync } = (
  process as unknown as {
    getBuiltinModule: (id: string) => {
      DatabaseSync: typeof import('node:sqlite').DatabaseSync;
    };
  }
).getBuiltinModule('node:sqlite');

const card: UserCard = {
  word_id: 'w', difficulty: 5, stability: 3, scheduled_days: 3, elapsed_days: 0,
  reps: 1, lapses: 0, last_review: 1_000, due: 2_000, state: 'review', note: null, leech: 0,
};

const log: ReviewLogRecord = {
  word_id: 'w', reviewed_at: 1_000, grade: Grade.Good, state_before: 'new',
  state_after: 'review', scheduled_days: 3, elapsed_days: 0, stability_after: 3,
  difficulty_after: 5, reveal_ms: 500, session_id: 1,
};

describe('SqliteReviewWriter', () => {
  it('runs the card update and log insert in one transaction', async () => {
    const statements: string[] = [];
    let transactionCalls = 0;
    const db = {
      withTransactionAsync: async (task: () => Promise<void>) => {
        transactionCalls += 1;
        await task();
      },
      runAsync: async (sql: string) => {
        statements.push(sql);
        return { lastInsertRowId: statements.length, changes: 1 } as SQLiteRunResult;
      },
    } as unknown as SQLiteDatabase;

    await new SqliteReviewWriter(db).save(card, log);

    expect(transactionCalls).toBe(1);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain('INSERT INTO user_card');
    expect(statements[1]).toContain('INSERT INTO review_log');
  });

  it('propagates a log failure through the transaction boundary', async () => {
    let rolledBack = false;
    const db = {
      withTransactionAsync: async (task: () => Promise<void>) => {
        try {
          await task();
        } catch (error) {
          rolledBack = true;
          throw error;
        }
      },
      runAsync: async (sql: string) => {
        if (sql.includes('review_log')) throw new Error('log insert failed');
        return { lastInsertRowId: 1, changes: 1 } as SQLiteRunResult;
      },
    } as unknown as SQLiteDatabase;

    await expect(new SqliteReviewWriter(db).save(card, log)).rejects.toThrow('log insert failed');
    expect(rolledBack).toBe(true);
  });

  it('rolls back the user_card write when the real SQLite log insert fails', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE user_card (
        word_id TEXT PRIMARY KEY,
        difficulty REAL NOT NULL,
        stability REAL NOT NULL,
        scheduled_days INTEGER NOT NULL,
        elapsed_days INTEGER NOT NULL,
        reps INTEGER NOT NULL,
        lapses INTEGER NOT NULL,
        last_review INTEGER NOT NULL,
        due INTEGER NOT NULL,
        state TEXT NOT NULL,
        note TEXT,
        leech INTEGER NOT NULL
      );
      CREATE TABLE review_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word_id TEXT NOT NULL,
        reviewed_at INTEGER NOT NULL,
        grade INTEGER NOT NULL,
        state_before TEXT,
        state_after TEXT NOT NULL,
        scheduled_days INTEGER NOT NULL,
        elapsed_days INTEGER NOT NULL,
        stability_after REAL NOT NULL,
        difficulty_after REAL NOT NULL,
        reveal_ms INTEGER,
        session_id INTEGER,
        scheduling_applied INTEGER NOT NULL DEFAULT 1
      );
      CREATE TRIGGER reject_review_log
      BEFORE INSERT ON review_log
      BEGIN
        SELECT RAISE(ABORT, 'injected log failure');
      END;
    `);
    const db = {
      withTransactionAsync: async (task: () => Promise<void>) => {
        sqlite.exec('BEGIN');
        try {
          await task();
          sqlite.exec('COMMIT');
        } catch (error) {
          sqlite.exec('ROLLBACK');
          throw error;
        }
      },
      runAsync: async (sql: string, params: unknown[] = []) =>
        sqlite.prepare(sql).run(...(params as never[])),
    } as unknown as SQLiteDatabase;

    await expect(new SqliteReviewWriter(db).save(card, log)).rejects.toThrow(
      'injected log failure',
    );

    expect(sqlite.prepare(`SELECT COUNT(*) AS n FROM user_card`).get()).toMatchObject({ n: 0 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS n FROM review_log`).get()).toMatchObject({ n: 0 });
  });
});

import { describe, expect, it } from 'vitest';
import type { SQLiteDatabase } from 'expo-sqlite';
import { SqliteUserCardRepo } from './SqliteUserCardRepo';

const { DatabaseSync } = (
  process as unknown as {
    getBuiltinModule: (id: string) => {
      DatabaseSync: typeof import('node:sqlite').DatabaseSync;
    };
  }
).getBuiltinModule('node:sqlite');

function createRepo(): SqliteUserCardRepo {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE word (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      qa_status TEXT NOT NULL,
      deprecated INTEGER NOT NULL
    );
    CREATE TABLE user_card (
      word_id TEXT PRIMARY KEY,
      stability REAL NOT NULL
    );
    INSERT INTO word VALUES
      ('active-mature', 'N5', 'verified', 0),
      ('active-learning', 'N5', 'verified', 0),
      ('deprecated', 'N5', 'verified', 1),
      ('draft', 'N5', 'draft', 0),
      ('other-level', 'N4', 'verified', 0);
    INSERT INTO user_card VALUES
      ('active-mature', 30),
      ('active-learning', 10),
      ('deprecated', 40),
      ('draft', 40),
      ('other-level', 40);
  `);

  const adapter = {
    getFirstAsync: async <T>(sql: string, params: unknown[] = []) =>
      (db.prepare(sql).get(...(params as never[])) ?? null) as T | null,
  } as unknown as SQLiteDatabase;
  return new SqliteUserCardRepo(adapter);
}

describe('SqliteUserCardRepo progress counts', () => {
  it('counts only active verified words in the studied numerator', async () => {
    expect(await createRepo().countStudiedByLevel('N5')).toBe(2);
  });

  it('counts only active verified words in the mature numerator', async () => {
    expect(await createRepo().countMatureByLevel('N5')).toBe(1);
  });
});

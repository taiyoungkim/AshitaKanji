import { describe, expect, it } from 'vitest';
import type { SQLiteDatabase } from 'expo-sqlite';
import { SqliteCardRepo } from './SqliteCardRepo';

const { DatabaseSync } = (
  process as unknown as {
    getBuiltinModule: (id: string) => {
      DatabaseSync: typeof import('node:sqlite').DatabaseSync;
    };
  }
).getBuiltinModule('node:sqlite');

describe('SqliteCardRepo.findNewCandidates', () => {
  it('uses NOT EXISTS without binding every existing user_card id', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE word (
        id TEXT PRIMARY KEY,
        level TEXT NOT NULL,
        surface TEXT NOT NULL,
        reading_kana TEXT NOT NULL,
        meaning_ko TEXT NOT NULL,
        card_type TEXT NOT NULL,
        qa_status TEXT NOT NULL,
        deprecated INTEGER NOT NULL,
        data_version INTEGER NOT NULL
      );
      CREATE TABLE user_card (word_id TEXT PRIMARY KEY);
    `);
    const insertWord = db.prepare(
      `INSERT INTO word VALUES (?, 'N5', ?, 'かな', '뜻', 'A', 'verified', 0, 1)`,
    );
    const insertCard = db.prepare(`INSERT INTO user_card VALUES (?)`);
    for (let index = 0; index < 1_500; index += 1) {
      const id = `existing-${index.toString().padStart(4, '0')}`;
      insertWord.run(id, id);
      insertCard.run(id);
    }
    insertWord.run('fresh', 'fresh');

    let boundParamCount = 0;
    const adapter = {
      getAllAsync: async <T>(sql: string, params: unknown[] = []) => {
        boundParamCount = params.length;
        return db.prepare(sql).all(...(params as never[])) as T[];
      },
    } as unknown as SQLiteDatabase;

    const result = await new SqliteCardRepo(adapter).findNewCandidates(['N5'], 12);

    expect(result.map((word) => word.id)).toEqual(['fresh']);
    expect(boundParamCount).toBe(2); // level + limit only
  });
});

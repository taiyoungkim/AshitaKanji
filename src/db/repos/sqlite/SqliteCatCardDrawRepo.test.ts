import { describe, expect, it } from 'vitest';
import type { SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_V8_ADDITIONS } from '../../schema';
import { SqliteCatCardDrawRepo } from './SqliteCatCardDrawRepo';

const { DatabaseSync } = (
  process as unknown as {
    getBuiltinModule: (id: string) => {
      DatabaseSync: typeof import('node:sqlite').DatabaseSync;
    };
  }
).getBuiltinModule('node:sqlite');

function openDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT)`);
  for (const sql of SCHEMA_V8_ADDITIONS) db.exec(sql);

  const queries = {
    getAllAsync: async <T>(sql: string, params: unknown[] = []) =>
      db.prepare(sql).all(...(params as never[])) as T[],
    runAsync: async (sql: string, params: unknown[] = []) => {
      const result = db.prepare(sql).run(...(params as never[]));
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
  };
  const adapter = {
    ...queries,
    withExclusiveTransactionAsync: async (task: (txn: typeof queries) => Promise<void>) => {
      db.exec('BEGIN EXCLUSIVE');
      try {
        await task(queries);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
  } as unknown as SQLiteDatabase;
  return { db, repo: new SqliteCatCardDrawRepo(adapter) };
}

describe('SqliteCatCardDrawRepo', () => {
  it('round-trips rows in draw order with boolean duplicate', async () => {
    const { repo } = openDb();
    await repo.insertWithin(() => ({ card_id: 'cat-002', drawn_at: 200, duplicate: true }));
    await repo.insertWithin(() => ({ card_id: 'cat-001', drawn_at: 100, duplicate: false }));

    expect(await repo.findAll()).toEqual([
      { id: 2, card_id: 'cat-001', drawn_at: 100, duplicate: false },
      { id: 1, card_id: 'cat-002', drawn_at: 200, duplicate: true },
    ]);
  });

  it('lets decide see earlier inserts so a second draw on the same stamps is refused', async () => {
    const { repo } = openDb();
    const oneDrawOnly = (existing: readonly unknown[]) =>
      existing.length === 0 ? { card_id: 'cat-001', drawn_at: 1, duplicate: false } : null;

    expect(await repo.insertWithin(oneDrawOnly)).not.toBeNull();
    expect(await repo.insertWithin(oneDrawOnly)).toBeNull();
    expect(await repo.findAll()).toHaveLength(1);
  });

  it('writes nothing when decide throws', async () => {
    const { repo } = openDb();
    await expect(
      repo.insertWithin(() => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await repo.findAll()).toHaveLength(0);
  });

  it('stamps the epoch once and never overwrites it', () => {
    const { db } = openDb();
    db.prepare(`UPDATE app_meta SET value = '2026-01-01' WHERE key = 'cat_card_epoch'`).run();
    for (const sql of SCHEMA_V8_ADDITIONS) db.exec(sql);
    expect(db.prepare(`SELECT value FROM app_meta WHERE key = 'cat_card_epoch'`).get()).toEqual({
      value: '2026-01-01',
    });
  });
});

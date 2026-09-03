import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { remapSuccessorWordIds } from './remapSuccessorWordIds';
import { WORD_ID_SUCCESSORS } from './wordIdSuccessors.gen';
import type { RemapDb } from './remapLegacyWordIds';

const { DatabaseSync } = (
  process as unknown as {
    getBuiltinModule: (id: string) => { DatabaseSync: typeof import('node:sqlite').DatabaseSync };
  }
).getBuiltinModule('node:sqlite');
type SqliteDb = import('node:sqlite').DatabaseSync;

function adapt(db: SqliteDb): RemapDb {
  return {
    getAllAsync: async <T>(sql: string, params: unknown[] = []) =>
      db.prepare(sql).all(...(params as never[])) as T[],
    getFirstAsync: async <T>(sql: string, params: unknown[] = []) =>
      (db.prepare(sql).get(...(params as never[])) ?? null) as T | null,
    runAsync: async (sql: string, params: unknown[] = []) =>
      db.prepare(sql).run(...(params as never[])),
  };
}

function setup(): SqliteDb {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE word (
      id TEXT PRIMARY KEY,
      surface TEXT,
      reading_kana TEXT,
      deprecated INTEGER DEFAULT 0,
      deprecated_reason TEXT,
      superseded_by TEXT
    );
    CREATE TABLE user_card (word_id TEXT PRIMARY KEY, reps INTEGER);
    CREATE TABLE review_log (id INTEGER PRIMARY KEY AUTOINCREMENT, word_id TEXT);
    CREATE TABLE scan_result (id INTEGER PRIMARY KEY AUTOINCREMENT, word_id TEXT);
    CREATE TABLE reading_progress (
      word_id TEXT, chapter INTEGER, known INTEGER,
      PRIMARY KEY (word_id, chapter)
    );
    INSERT INTO word VALUES
      ('w_old_spell','やむをえない','やむをえない',1,NULL,NULL),
      ('w_new_spell','やむを得ない','やむをえない',0,NULL,NULL),
      ('w_old_kana','ならう','ならう',1,NULL,NULL),
      ('w_new_kanji','習う','ならう',0,NULL,NULL),
      ('w_orphan_old','古語','こご',1,NULL,NULL);
    INSERT INTO user_card VALUES
      ('w_old_spell',4),
      ('w_old_kana',2),
      ('w_new_kanji',6),
      ('w_orphan_old',1);
    INSERT INTO review_log (word_id) VALUES ('w_old_spell'), ('w_old_kana');
    INSERT INTO reading_progress VALUES
      ('w_old_spell',1,1),
      ('w_old_kana',1,1),
      ('w_new_kanji',1,0);
  `);
  return db;
}

const all = (db: SqliteDb, sql: string) => db.prepare(sql).all() as Record<string, unknown>[];

const SUCCESSORS = {
  w_old_spell: 'w_new_spell',
  w_old_kana: 'w_new_kanji',
  w_orphan_old: 'w_missing_new',
};

describe('WORD_ID_SUCCESSORS policy', () => {
  it('contains only identity_changed spelling fixes from the core manifest', () => {
    const manifest = JSON.parse(
      readFileSync(resolve('data/pdf-vocab/jlpt_final_replacement_manifest.json'), 'utf8'),
    ) as {
      retained_corrections: {
        old_id: string;
        new_id: string;
        identity_changed?: number;
      }[];
    };
    const expected = Object.fromEntries(
      manifest.retained_corrections
        .filter((row) => row.identity_changed && row.old_id && row.new_id && row.old_id !== row.new_id)
        .map((row) => [row.old_id, row.new_id]),
    );
    expect(WORD_ID_SUCCESSORS).toMatchObject(expected);
    expect(Object.keys(expected)).toHaveLength(47);
  });
});

describe('remapSuccessorWordIds', () => {
  let db: SqliteDb;
  beforeEach(() => {
    db = setup();
  });

  it('moves a card onto the surviving spelling', async () => {
    await remapSuccessorWordIds(adapt(db), SUCCESSORS);
    const card = db
      .prepare(`SELECT reps FROM user_card WHERE word_id='w_new_spell'`)
      .get() as { reps: number };
    expect(card.reps).toBe(4);
    expect(all(db, `SELECT * FROM user_card WHERE word_id='w_old_spell'`)).toEqual([]);
  });

  it('merges into an existing successor card and keeps the stronger one', async () => {
    await remapSuccessorWordIds(adapt(db), SUCCESSORS);
    const cards = all(db, `SELECT reps FROM user_card WHERE word_id='w_new_kanji'`);
    expect(cards).toHaveLength(1);
    expect((cards[0] as { reps: number }).reps).toBe(6);
  });

  it('stamps superseded_by on the retired row', async () => {
    await remapSuccessorWordIds(adapt(db), SUCCESSORS);
    const row = db
      .prepare(`SELECT superseded_by, deprecated_reason FROM word WHERE id='w_old_spell'`)
      .get() as { superseded_by: string; deprecated_reason: string };
    expect(row.superseded_by).toBe('w_new_spell');
    expect(row.deprecated_reason).toBe('replaced');
  });

  it('skips mappings whose successor is not in the word table', async () => {
    const stats = await remapSuccessorWordIds(adapt(db), SUCCESSORS);
    expect(stats.unmatched).toBe(1);
    expect(all(db, `SELECT * FROM user_card WHERE word_id='w_orphan_old'`)).toHaveLength(1);
  });

  it('is idempotent', async () => {
    await remapSuccessorWordIds(adapt(db), SUCCESSORS);
    const before = all(db, `SELECT * FROM user_card ORDER BY word_id`);
    const stats = await remapSuccessorWordIds(adapt(db), SUCCESSORS);
    expect(stats.cardsMoved).toBe(0);
    expect(stats.cardsMerged).toBe(0);
    expect(all(db, `SELECT * FROM user_card ORDER BY word_id`)).toEqual(before);
  });
});

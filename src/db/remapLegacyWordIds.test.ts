// Regression: v4 (legacy ids) → v5 (stable hash ids) on-device migration.
// Verifies existing user data is repointed to hash ids (no progress lost), and
// that collapsed cross-level duplicates merge without dropping the stronger card.

import { beforeEach, describe, expect, it } from 'vitest';
import { remapLegacyWordIds, type RemapDb } from './remapLegacyWordIds';

// Load node:sqlite via getBuiltinModule so Vite's static resolver doesn't try to
// bundle it (newer builtin that Vite mis-resolves to a bare "sqlite" package).
const { DatabaseSync } = (
  process as unknown as { getBuiltinModule: (id: string) => { DatabaseSync: typeof import('node:sqlite').DatabaseSync } }
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
    CREATE TABLE word (id TEXT PRIMARY KEY, surface TEXT, reading_kana TEXT, deprecated INTEGER DEFAULT 0);
    CREATE TABLE user_card (word_id TEXT PRIMARY KEY, reps INTEGER);
    CREATE TABLE review_log (id INTEGER PRIMARY KEY AUTOINCREMENT, word_id TEXT);
    CREATE TABLE scan_result (id INTEGER PRIMARY KEY AUTOINCREMENT, word_id TEXT);
    CREATE TABLE reading_progress (word_id TEXT, chapter INTEGER, known INTEGER, PRIMARY KEY (word_id, chapter));
  `);
  // Post-upsert state: legacy rows + freshly-inserted hash rows coexist.
  db.exec(`
    INSERT INTO word VALUES
      ('n5-0001-質問-しつもん','質問','しつもん',0),
      ('w_aaa','質問','しつもん',0),
      ('n3-0016-酸性','酸性','さんせい',0),
      ('n2-0742-酸性','酸性','さんせい',0),
      ('w_bbb','酸性','さんせい',0),
      ('n4-0009-only-legacy','古語','こご',0);
    INSERT INTO user_card VALUES
      ('n5-0001-質問-しつもん',5),
      ('n3-0016-酸性',3),
      ('n2-0742-酸性',7);
    INSERT INTO review_log (word_id) VALUES ('n5-0001-質問-しつもん');
    INSERT INTO scan_result (word_id) VALUES ('n3-0016-酸性');
    INSERT INTO reading_progress VALUES
      ('n5-0001-質問-しつもん',1,1),
      ('n3-0016-酸性',1,0),
      ('n2-0742-酸性',1,1);
  `);
  return db;
}

const all = (db: SqliteDb, sql: string) => db.prepare(sql).all() as Record<string, unknown>[];

describe('remapLegacyWordIds (v4→v5)', () => {
  let db: SqliteDb;
  beforeEach(() => {
    db = setup();
  });

  it('repoints all user data off legacy ids onto hash ids', async () => {
    await remapLegacyWordIds(adapt(db));

    const legacyRefs = [
      ...all(db, `SELECT word_id FROM user_card WHERE substr(word_id,1,2)<>'w_'`),
      ...all(db, `SELECT word_id FROM review_log WHERE substr(word_id,1,2)<>'w_'`),
      ...all(db, `SELECT word_id FROM scan_result WHERE substr(word_id,1,2)<>'w_'`),
      ...all(db, `SELECT word_id FROM reading_progress WHERE substr(word_id,1,2)<>'w_'`),
    ];
    expect(legacyRefs).toEqual([]);
  });

  it('preserves a card and its progress across the id change', async () => {
    await remapLegacyWordIds(adapt(db));
    const card = db.prepare(`SELECT reps FROM user_card WHERE word_id='w_aaa'`).get() as { reps: number };
    expect(card.reps).toBe(5);
    const log = db.prepare(`SELECT COUNT(*) n FROM review_log WHERE word_id='w_aaa'`).get() as { n: number };
    expect(log.n).toBe(1);
  });

  it('merges collapsed cross-level twins, keeping the stronger card', async () => {
    await remapLegacyWordIds(adapt(db));
    const cards = all(db, `SELECT reps FROM user_card WHERE word_id='w_bbb'`);
    expect(cards).toHaveLength(1);
    expect((cards[0] as { reps: number }).reps).toBe(7); // n2 twin (reps 7) beats n3 twin (reps 3)
  });

  it('ORs the known flag when reading_progress rows collide', async () => {
    await remapLegacyWordIds(adapt(db));
    const rows = all(db, `SELECT chapter, known FROM reading_progress WHERE word_id='w_bbb'`);
    expect(rows).toHaveLength(1);
    expect((rows[0] as { known: number }).known).toBe(1);
  });

  it('reports stats and leaves words with no hash twin untouched', async () => {
    const stats = await remapLegacyWordIds(adapt(db));
    expect(stats.legacyWords).toBe(4); // 質問, 酸性×2, 古語
    expect(stats.remappedWords).toBe(3); // 古語 has no hash twin
    expect(stats.unmatched).toBe(1);
  });

  it('is idempotent — a second run does not move or merge any cards', async () => {
    await remapLegacyWordIds(adapt(db));
    const before = all(db, `SELECT * FROM user_card ORDER BY word_id`);
    // Legacy word rows still exist (deprecation is the hydration step's job), so the
    // second run re-scans them — but their user data is already gone, so nothing moves.
    const stats = await remapLegacyWordIds(adapt(db));
    expect(stats.cardsMoved).toBe(0);
    expect(stats.cardsMerged).toBe(0);
    expect(all(db, `SELECT * FROM user_card ORDER BY word_id`)).toEqual(before);
  });
});

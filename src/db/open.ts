// Design Ref: §3 Data Model + §11 Implementation Guide (B1)
// Plan Ref: §7 빌드 파이프라인 — assets/jlpt.db 번들 → 첫 실행 시 documentDir 복사
// Plan SC: user_card 절대 손실 X (앱 업데이트 시 user_card 보존)
//
// Open strategy:
//   1. If bundled DB asset (assets/jlpt.db) exists, copy to FileSystem.documentDirectory
//      on first launch (or when data_version increases).
//   2. Otherwise, open empty DB and run migrations.
//   3. Always run migrations to current version (idempotent).

import * as SQLite from 'expo-sqlite';
import { migrateToV1 } from './migrations/v1';
import { migrateToV2 } from './migrations/v2';
import { CURRENT_SCHEMA_VERSION } from './schema';

const DB_NAME = 'ashitakanji.db';
const SEED_DB_NAME = 'ashitakanji.seed.db';
const WORD_CURATION_VERSION = '3';
const KANJI_CURATION_VERSION = '2';
const EXAMPLE_CURATION_VERSION = '1';
const BUNDLED_DB_REQUIRE = (() => {
  try {
    // assets/jlpt.db is created by scripts/build-db.ts (Track A6)
    // During Track B development, this file may not exist yet.
    return require('../../assets/jlpt.db');
  } catch {
    return null;
  }
})();

let _db: SQLite.SQLiteDatabase | null = null;
let _dbInit: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  if (_dbInit) return _dbInit;

  _dbInit = openDatabase();
  try {
    return await _dbInit;
  } catch (err) {
    _dbInit = null;
    throw err;
  }
}

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  await importBundledDatabaseIfAvailable();

  const db = await SQLite.openDatabaseAsync(DB_NAME);

  // PRAGMAs
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');

  // Always run migrations
  await runMigrations(db);
  await hydrateSeedDataIfNeeded(db);

  // 데이터 적재 상태 점검 — 빈 DB로 조용히 출시되는 사고 방지(P0).
  // assets/jlpt.db 미탑재(Track A 미완) 시 word 테이블이 0행 → 가시 경고.
  await refreshDataStatus(db);
  if (_wordCount === 0) {
    console.warn(
      '[db] WORD TABLE EMPTY — assets/jlpt.db 미탑재. ' +
        '학습 데이터 없이 실행 중(개발 단계 정상, 출시 차단 대상).',
    );
  }

  _db = db;
  return _db;
}

async function importBundledDatabaseIfAvailable(): Promise<void> {
  if (!BUNDLED_DB_REQUIRE) return;
  try {
    await SQLite.importDatabaseFromAssetAsync(DB_NAME, {
      assetId: BUNDLED_DB_REQUIRE as number,
      forceOverwrite: false,
    });
  } catch (err) {
    // Bundled DB not present or import unsupported in this runtime — start with empty DB.
    console.warn('[db] bundled asset import skipped:', err);
  }
}

interface KanjiSeedRow {
  literal: string;
  meanings_ko: string;
  onyomi: string | null;
  kunyomi: string | null;
  radical: string | null;
  radical_name_ko: string | null;
  radical_number: number | null;
  stroke_count: number | null;
  source: string;
  source_url: string | null;
  license: string | null;
  qa_status: string;
  data_version: number;
}

interface WordSeedRow {
  id: string;
  level: string;
  surface: string;
  reading_kana: string;
  furigana: string | null;
  meaning_ko: string;
  part_of_speech: string | null;
  card_type: string;
  example_jp: string | null;
  example_ko: string | null;
  example_jp_id: number | null;
  example_jp_author: string | null;
  example_ko_id: number | null;
  example_ko_author: string | null;
  example_license: string | null;
  alt_forms: string | null;
  disambig: string | null;
  source: string | null;
  qa_status: string;
  deprecated: number;
  tags: string | null;
  data_version: number;
}

interface WordKanjiSeedRow {
  word_id: string;
  literal: string;
  position: number;
}

interface WordExampleSeedRow {
  word_id: string;
  jp: string;
  ko: string | null;
  source: string;
  source_url: string | null;
  license: string | null;
  permission_status: string;
  attribution: string | null;
  captured_at: number | null;
  qa_status: string;
  sort_order: number;
}

async function hydrateSeedDataIfNeeded(db: SQLite.SQLiteDatabase): Promise<void> {
  const needsWordHydration = await shouldHydrateWordData(db);
  const kanjiCount = await countTableRows(db, 'kanji');
  const wordKanjiCount = await countTableRows(db, 'word_kanji');
  const wordExampleCount = await countTableRows(db, 'word_example');
  const needsKanjiHydration = await shouldHydrateKanjiData(db, kanjiCount, wordKanjiCount);
  const needsExampleHydration = await shouldHydrateExampleData(db, wordExampleCount);
  if (!needsWordHydration && !needsKanjiHydration && !needsExampleHydration) return;
  if (!BUNDLED_DB_REQUIRE) return;

  try {
    await SQLite.importDatabaseFromAssetAsync(SEED_DB_NAME, {
      assetId: BUNDLED_DB_REQUIRE as number,
      forceOverwrite: true,
    });
    const seedDb = await SQLite.openDatabaseAsync(SEED_DB_NAME);
    try {
      const [wordRows, kanjiRows, wordKanjiRows, wordExampleRows, localWordRows] = await Promise.all([
        seedDb.getAllAsync<WordSeedRow>(`SELECT * FROM word`),
        seedDb.getAllAsync<KanjiSeedRow>(`SELECT * FROM kanji`),
        seedDb.getAllAsync<WordKanjiSeedRow>(`SELECT * FROM word_kanji ORDER BY word_id, position`),
        seedDb.getAllAsync<WordExampleSeedRow>(
          `SELECT word_id, jp, ko, source, source_url, license, permission_status,
                  attribution, captured_at, qa_status, sort_order
           FROM word_example
           ORDER BY word_id, sort_order, id`,
        ),
        db.getAllAsync<{ id: string }>(`SELECT id FROM word`),
      ]);

      const localWordIds = new Set(localWordRows.map((row) => row.id));
      const seedWordIds = new Set(wordRows.map((row) => row.id));
      const validWordIds = needsWordHydration ? seedWordIds : localWordIds;
      await db.execAsync('BEGIN IMMEDIATE');
      try {
        if (needsWordHydration && wordRows.length > 0) {
          for (const row of wordRows) {
            await upsertSeedWord(db, row);
          }
          for (const id of localWordIds) {
            if (!seedWordIds.has(id)) {
              await db.runAsync(`UPDATE word SET deprecated = 1 WHERE id = ?`, [id]);
            }
          }
          await db.runAsync(
            `UPDATE word
             SET deprecated = 1
             WHERE surface LIKE '%~%' OR surface LIKE '%～%' OR surface LIKE '%〜%'
                OR reading_kana LIKE '%~%' OR reading_kana LIKE '%～%' OR reading_kana LIKE '%〜%'`,
          );
          await db.runAsync(
            `INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`,
            ['word_curation_version', WORD_CURATION_VERSION],
          );
        }

        if (needsKanjiHydration && kanjiRows.length > 0 && wordKanjiRows.length > 0) {
          await db.execAsync('DELETE FROM word_kanji');
          await db.execAsync('DELETE FROM kanji');
          for (const row of kanjiRows) {
            await db.runAsync(
              `INSERT INTO kanji
                (literal, meanings_ko, onyomi, kunyomi, radical, radical_name_ko, radical_number,
                 stroke_count, source, source_url, license, qa_status, data_version)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                row.literal,
                row.meanings_ko,
                row.onyomi,
                row.kunyomi,
                row.radical,
                row.radical_name_ko,
                row.radical_number,
                row.stroke_count,
                row.source,
                row.source_url,
                row.license,
                row.qa_status,
                row.data_version,
              ],
            );
          }
          for (const row of wordKanjiRows) {
            if (!validWordIds.has(row.word_id)) continue;
            await db.runAsync(
              `INSERT INTO word_kanji (word_id, literal, position) VALUES (?, ?, ?)`,
              [row.word_id, row.literal, row.position],
            );
          }
          await db.runAsync(
            `INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`,
            ['kanji_curation_version', KANJI_CURATION_VERSION],
          );
        }

        if (needsExampleHydration) {
          await db.execAsync('DELETE FROM word_example');
          for (const row of wordExampleRows) {
            if (!validWordIds.has(row.word_id)) continue;
            await db.runAsync(
              `INSERT INTO word_example
                (word_id, jp, ko, source, source_url, license, permission_status,
                 attribution, captured_at, qa_status, sort_order)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                row.word_id,
                row.jp,
                row.ko,
                row.source,
                row.source_url,
                row.license,
                row.permission_status,
                row.attribution,
                row.captured_at,
                row.qa_status,
                row.sort_order,
              ],
            );
          }
          await db.runAsync(
            `INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`,
            ['example_curation_version', EXAMPLE_CURATION_VERSION],
          );
        }
        await db.execAsync('COMMIT');
      } catch (err) {
        await db.execAsync('ROLLBACK');
        throw err;
      }
    } finally {
      await seedDb.closeAsync();
    }
  } catch (err) {
    console.warn('[db] kanji seed hydration skipped:', err);
  }
}

async function shouldHydrateWordData(db: SQLite.SQLiteDatabase): Promise<boolean> {
  const version = await getAppMeta(db, 'word_curation_version');
  if (version !== WORD_CURATION_VERSION) return true;
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n
     FROM word
     WHERE deprecated = 0
       AND (surface LIKE '%~%' OR surface LIKE '%～%' OR surface LIKE '%〜%'
         OR reading_kana LIKE '%~%' OR reading_kana LIKE '%～%' OR reading_kana LIKE '%〜%')`,
  );
  return (row?.n ?? 0) > 0;
}

async function shouldHydrateKanjiData(
  db: SQLite.SQLiteDatabase,
  kanjiCount: number,
  wordKanjiCount: number,
): Promise<boolean> {
  if (kanjiCount === 0 || wordKanjiCount === 0) return true;
  const version = await getAppMeta(db, 'kanji_curation_version');
  if (version !== KANJI_CURATION_VERSION) return true;
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n
     FROM kanji
     WHERE meanings_ko GLOB '*[A-Za-z]*'`,
  );
  return (row?.n ?? 0) > 0;
}

async function shouldHydrateExampleData(
  db: SQLite.SQLiteDatabase,
  wordExampleCount: number,
): Promise<boolean> {
  const version = await getAppMeta(db, 'example_curation_version');
  if (version !== EXAMPLE_CURATION_VERSION) return true;
  return wordExampleCount === 0;
}

async function getAppMeta(db: SQLite.SQLiteDatabase, key: string): Promise<string | null> {
  try {
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM app_meta WHERE key = ?`,
      [key],
    );
    return row?.value ?? null;
  } catch {
    return null;
  }
}

async function upsertSeedWord(db: SQLite.SQLiteDatabase, row: WordSeedRow): Promise<void> {
  await db.runAsync(
    `INSERT INTO word
      (id, level, surface, reading_kana, furigana, meaning_ko, part_of_speech, card_type,
       example_jp, example_ko, example_jp_id, example_jp_author, example_ko_id, example_ko_author,
       example_license, alt_forms, disambig, source, qa_status, deprecated, tags, data_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       level = excluded.level,
       surface = excluded.surface,
       reading_kana = excluded.reading_kana,
       furigana = excluded.furigana,
       meaning_ko = excluded.meaning_ko,
       part_of_speech = excluded.part_of_speech,
       card_type = excluded.card_type,
       example_jp = excluded.example_jp,
       example_ko = excluded.example_ko,
       example_jp_id = excluded.example_jp_id,
       example_jp_author = excluded.example_jp_author,
       example_ko_id = excluded.example_ko_id,
       example_ko_author = excluded.example_ko_author,
       example_license = excluded.example_license,
       alt_forms = excluded.alt_forms,
       disambig = excluded.disambig,
       source = excluded.source,
       qa_status = excluded.qa_status,
       deprecated = excluded.deprecated,
       tags = excluded.tags,
       data_version = excluded.data_version`,
    [
      row.id,
      row.level,
      row.surface,
      row.reading_kana,
      row.furigana,
      row.meaning_ko,
      row.part_of_speech,
      row.card_type,
      row.example_jp,
      row.example_ko,
      row.example_jp_id,
      row.example_jp_author,
      row.example_ko_id,
      row.example_ko_author,
      row.example_license,
      row.alt_forms,
      row.disambig,
      row.source,
      row.qa_status,
      row.deprecated,
      row.tags,
      row.data_version,
    ],
  );
}

async function countTableRows(db: SQLite.SQLiteDatabase, table: string): Promise<number> {
  try {
    const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

/** 마지막으로 확인한 word 테이블 행 수 (-1 = 미확인). */
let _wordCount = -1;

async function refreshDataStatus(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const row = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM word`,
    );
    _wordCount = row?.n ?? 0;
  } catch {
    _wordCount = 0;
  }
}

/**
 * 탑재된 학습 데이터(word) 행 수. getDatabase() 이후 유효(미호출 시 -1).
 * UI가 "오늘 카드 없음"(정상)과 "데이터 미탑재"(빌드 필요)를 구분하는 데 사용.
 */
export function getWordCount(): number {
  return _wordCount;
}

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  // Plan SC: user_card 보존 — migrations only ADD, never DROP user data tables.
  const current = await getSchemaVersion(db);

  if (current < 1) {
    await migrateToV1(db);
  }
  if (current < 2) {
    await migrateToV2(db);
  }
  // Future: if (current < 3) await migrateToV3(db); ...

  const after = await getSchemaVersion(db);
  if (after !== CURRENT_SCHEMA_VERSION) {
    console.warn(`[db] schema version mismatch: target=${CURRENT_SCHEMA_VERSION}, actual=${after}`);
  }
}

async function getSchemaVersion(db: SQLite.SQLiteDatabase): Promise<number> {
  try {
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM app_meta WHERE key = 'schema_version'`,
    );
    return row ? Number.parseInt(row.value, 10) : 0;
  } catch {
    // app_meta table does not exist yet
    return 0;
  }
}

/** For tests only — reset cached connection. */
export function _resetDatabase(): void {
  _db = null;
  _dbInit = null;
}

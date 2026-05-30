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
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { migrateToV1 } from './migrations/v1';
import { CURRENT_SCHEMA_VERSION } from './schema';

const DB_NAME = 'ashitakanji.db';
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

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;

  const targetPath = `${FileSystem.documentDirectory}SQLite/${DB_NAME}`;
  const dirPath = `${FileSystem.documentDirectory}SQLite`;

  // Ensure SQLite directory exists
  const dirInfo = await FileSystem.getInfoAsync(dirPath);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
  }

  // Copy bundled DB if present and not yet copied
  const targetInfo = await FileSystem.getInfoAsync(targetPath);
  if (!targetInfo.exists && BUNDLED_DB_REQUIRE) {
    try {
      const asset = Asset.fromModule(BUNDLED_DB_REQUIRE);
      await asset.downloadAsync();
      if (asset.localUri) {
        await FileSystem.copyAsync({ from: asset.localUri, to: targetPath });
      }
    } catch (err) {
      // Bundled DB not present (Track B in progress) — start with empty DB
      console.warn('[db] bundled asset copy skipped:', err);
    }
  }

  _db = await SQLite.openDatabaseAsync(DB_NAME);

  // PRAGMAs
  await _db.execAsync('PRAGMA journal_mode = WAL');
  await _db.execAsync('PRAGMA foreign_keys = ON');

  // Always run migrations
  await runMigrations(_db);

  // 데이터 적재 상태 점검 — 빈 DB로 조용히 출시되는 사고 방지(P0).
  // assets/jlpt.db 미탑재(Track A 미완) 시 word 테이블이 0행 → 가시 경고.
  await refreshDataStatus(_db);
  if (_wordCount === 0) {
    console.warn(
      '[db] WORD TABLE EMPTY — assets/jlpt.db 미탑재. ' +
        '학습 데이터 없이 실행 중(개발 단계 정상, 출시 차단 대상).',
    );
  }

  return _db;
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
  // Future: if (current < 2) await migrateToV2(db); ...

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
}

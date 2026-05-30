// Design Ref: §3 Data Model — initial schema migration
// Plan Ref: §15 (user_card 절대 손실 X — 마이그레이션은 schema_version 단위 추적)

import type { SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_V1 } from '../schema';

/**
 * Apply schema v1 (initial).
 * Safe to call repeatedly — all statements use IF NOT EXISTS.
 */
export async function migrateToV1(db: SQLiteDatabase): Promise<void> {
  for (const stmt of SCHEMA_V1) {
    await db.execAsync(stmt);
  }
  // Mark schema version
  await db.runAsync(
    `INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`,
    ['schema_version', '1'],
  );
}

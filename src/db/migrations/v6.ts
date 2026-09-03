// v6 — reading coverage is independent from mastery; derived sessions retain their source.

import type { SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_V6_ADDITIONS } from '../schema';

export async function migrateToV6(db: SQLiteDatabase): Promise<void> {
  for (const stmt of SCHEMA_V6_ADDITIONS) {
    await db.execAsync(stmt);
  }
  await db.runAsync(
    `INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`,
    ['schema_version', '6'],
  );
}

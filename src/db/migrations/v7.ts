// v7 — distinguish schedule-changing reviews from supplemental practice.

import type { SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_V7_ADDITIONS } from '../schema';

export async function migrateToV7(db: SQLiteDatabase): Promise<void> {
  for (const stmt of SCHEMA_V7_ADDITIONS) {
    await db.execAsync(stmt);
  }
  await db.runAsync(
    `INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`,
    ['schema_version', '7'],
  );
}

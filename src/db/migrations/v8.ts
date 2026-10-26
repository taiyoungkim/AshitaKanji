// v8 — cat card draw log + stamp epoch.

import type { SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_V8_ADDITIONS } from '../schema';

export async function migrateToV8(db: SQLiteDatabase): Promise<void> {
  for (const stmt of SCHEMA_V8_ADDITIONS) {
    await db.execAsync(stmt);
  }
  await db.runAsync(
    `INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`,
    ['schema_version', '8'],
  );
}

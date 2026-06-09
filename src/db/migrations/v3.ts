// v3 — 회독(read-through) support:
//   - word.frequency (wordfreq Zipf, general JA corpus)
//   - word.reading_chapter (frozen 50-word chapter index within level)
// Columns are hydrated from the bundled seed DB; existing user data untouched.

import type { SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_V3_ADDITIONS } from '../schema';

export async function migrateToV3(db: SQLiteDatabase): Promise<void> {
  for (const stmt of SCHEMA_V3_ADDITIONS) {
    await db.execAsync(stmt);
  }
  await db.runAsync(
    `INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`,
    ['schema_version', '3'],
  );
}

// Post-MVP learning detail schema additions:
//   - kanji master data
//   - word_kanji render order
//   - word_example future multi-example model

import type { SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_V2_ADDITIONS } from '../schema';

export async function migrateToV2(db: SQLiteDatabase): Promise<void> {
  for (const stmt of SCHEMA_V2_ADDITIONS) {
    await db.execAsync(stmt);
  }
  await db.runAsync(
    `INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`,
    ['schema_version', '2'],
  );
}

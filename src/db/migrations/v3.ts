// v3 — 회독(read-through) support:
//   - word.frequency (wordfreq Zipf, general JA corpus)
//   - word.reading_chapter (frozen 50-word chapter index within level)
// Columns are hydrated from the bundled seed DB; existing user data untouched.

import type { SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_V3_ADDITIONS } from '../schema';

export async function migrateToV3(db: SQLiteDatabase): Promise<void> {
  // 멱등 보장(open.ts 계약): 번들 seed DB가 frequency/reading_chapter 컬럼을
  // 이미 가진 채 schema_version<3 으로 기록될 수 있어 ALTER ADD COLUMN 이 재실행됨.
  // SQLite 는 ADD COLUMN 에 IF NOT EXISTS 가 없으므로 "duplicate column" 만 무시.
  for (const stmt of SCHEMA_V3_ADDITIONS) {
    try {
      await db.execAsync(stmt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/duplicate column name/i.test(msg)) throw err;
    }
  }
  await db.runAsync(
    `INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`,
    ['schema_version', '3'],
  );
}

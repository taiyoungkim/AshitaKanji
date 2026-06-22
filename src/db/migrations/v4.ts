// v4 — 누적 회독: reading_progress 를 (word_id, chapter) 복합키로 교체.
// 챕터 N = reading_chapter<=N 단어 전체를 회차마다 다시 테스트하므로
// known 상태가 챕터(회차)별로 독립이어야 한다. v3 테이블은 비어있어 DROP 안전.

import type { SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_V4_ADDITIONS } from '../schema';

export async function migrateToV4(db: SQLiteDatabase): Promise<void> {
  for (const stmt of SCHEMA_V4_ADDITIONS) {
    await db.execAsync(stmt);
  }
  await db.runAsync(
    `INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`,
    ['schema_version', '4'],
  );
}

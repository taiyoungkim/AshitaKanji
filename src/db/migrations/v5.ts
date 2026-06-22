// v5 — deprecation taxonomy: add word.deprecated_reason + word.superseded_by.
// word.id is now a stable content hash (surface+reading), so words leave active
// study only via deprecation. These columns let future update policy branch by
// reason and remap user_card to a survivor on merges instead of silently hiding it.
// Additive only — no user data touched (Plan SC: user_card 절대 손실 X).

import type { SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_V5_ADDITIONS } from '../schema';

export async function migrateToV5(db: SQLiteDatabase): Promise<void> {
  for (const stmt of SCHEMA_V5_ADDITIONS) {
    await db.execAsync(stmt);
  }
  await db.runAsync(
    `INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`,
    ['schema_version', '5'],
  );
}

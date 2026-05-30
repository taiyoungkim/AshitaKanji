// Design Ref: §3.2 / §3 app_meta — SQLite 구현 (key/value).

import type { SQLiteDatabase } from 'expo-sqlite';
import type { AppMetaRepo } from '../AppMetaRepo';

interface AppMetaRow {
  key: string;
  value: string | null;
}

export class SqliteAppMetaRepo implements AppMetaRepo {
  constructor(private readonly db: SQLiteDatabase) {}

  async get(key: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<AppMetaRow>(
      `SELECT value FROM app_meta WHERE key = ?`,
      [key],
    );
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`,
      [key, value],
    );
  }

  async getAll(): Promise<Record<string, string | null>> {
    const rows = await this.db.getAllAsync<AppMetaRow>(`SELECT key, value FROM app_meta`);
    const out: Record<string, string | null> = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  }
}

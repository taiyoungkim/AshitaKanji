// Design Ref: §3.2 / §3 daily_stats — SQLite 구현 (lazy rollup 저장).
// rollup 재계산 idempotent → INSERT OR REPLACE (PRIMARY KEY date).

import type { SQLiteDatabase } from 'expo-sqlite';
import type { DailyStats } from '~/types/DailyStats';
import type { DailyStatsRepo } from '../DailyStatsRepo';

interface DailyStatsRow {
  date: string;
  new_count: number;
  review_count: number;
  scan_count: number;
  scan_promoted_count: number;
  again_count: number;
  good_easy_count: number;
  total_time_sec: number;
  session_count: number;
  completed_session_count: number;
  avg_reveal_ms: number | null;
}

function rowToStats(r: DailyStatsRow): DailyStats {
  return { ...r };
}

export class SqliteDailyStatsRepo implements DailyStatsRepo {
  constructor(private readonly db: SQLiteDatabase) {}

  async upsert(row: DailyStats): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO daily_stats
        (date, new_count, review_count, scan_count, scan_promoted_count,
         again_count, good_easy_count, total_time_sec, session_count,
         completed_session_count, avg_reveal_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.date,
        row.new_count,
        row.review_count,
        row.scan_count,
        row.scan_promoted_count,
        row.again_count,
        row.good_easy_count,
        row.total_time_sec,
        row.session_count,
        row.completed_session_count,
        row.avg_reveal_ms,
      ],
    );
  }

  async findByDate(date: string): Promise<DailyStats | null> {
    const row = await this.db.getFirstAsync<DailyStatsRow>(
      `SELECT * FROM daily_stats WHERE date = ?`,
      [date],
    );
    return row ? rowToStats(row) : null;
  }

  async findRange(startDate: string, endDate: string): Promise<DailyStats[]> {
    const rows = await this.db.getAllAsync<DailyStatsRow>(
      `SELECT * FROM daily_stats WHERE date >= ? AND date <= ? ORDER BY date ASC`,
      [startDate, endDate],
    );
    return rows.map(rowToStats);
  }

  async findAll(): Promise<DailyStats[]> {
    const rows = await this.db.getAllAsync<DailyStatsRow>(
      `SELECT * FROM daily_stats ORDER BY date ASC`,
    );
    return rows.map(rowToStats);
  }
}

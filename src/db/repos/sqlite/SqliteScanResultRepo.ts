// Design Ref: §3.2 / §3 scan_result — SQLite 구현.

import type { SQLiteDatabase } from 'expo-sqlite';
import type { ScanGrade, ScanResultRecord } from '~/types/ScanResult';
import type { ScanResultRepo } from '../ScanResultRepo';

interface ScanResultRow {
  id: number;
  word_id: string;
  scanned_at: number;
  result: string;
  batch_size: number | null;
  promoted_to_srs: number;
  session_id: number | null;
}

function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(',');
}

function rowToRec(r: ScanResultRow): ScanResultRecord {
  return {
    id: r.id,
    word_id: r.word_id,
    scanned_at: r.scanned_at,
    result: r.result as ScanGrade,
    batch_size: r.batch_size,
    promoted_to_srs: r.promoted_to_srs === 1 ? 1 : 0,
    session_id: r.session_id,
  };
}

export class SqliteScanResultRepo implements ScanResultRepo {
  constructor(private readonly db: SQLiteDatabase) {}

  async record(rec: ScanResultRecord): Promise<void> {
    // 재분류 시 1건만 유지: 동일 (session_id, word_id) 제거 후 삽입.
    await this.db.runAsync(
      `DELETE FROM scan_result WHERE word_id = ? AND session_id IS ?`,
      [rec.word_id, rec.session_id ?? null],
    );
    await this.db.runAsync(
      `INSERT INTO scan_result
        (word_id, scanned_at, result, batch_size, promoted_to_srs, session_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        rec.word_id,
        rec.scanned_at,
        rec.result,
        rec.batch_size ?? null,
        rec.promoted_to_srs,
        rec.session_id ?? null,
      ],
    );
  }

  async findBySession(sessionId: number): Promise<ScanResultRecord[]> {
    const rows = await this.db.getAllAsync<ScanResultRow>(
      `SELECT * FROM scan_result WHERE session_id = ? ORDER BY id ASC`,
      [sessionId],
    );
    return rows.map(rowToRec);
  }

  async findUnpromotedWeak(): Promise<ScanResultRecord[]> {
    const rows = await this.db.getAllAsync<ScanResultRow>(
      `SELECT * FROM scan_result
       WHERE result IN ('confused','unknown') AND promoted_to_srs = 0
       ORDER BY scanned_at DESC`,
    );
    return rows.map(rowToRec);
  }

  async markPromoted(wordIds: string[]): Promise<void> {
    if (wordIds.length === 0) return;
    await this.db.runAsync(
      `UPDATE scan_result SET promoted_to_srs = 1
       WHERE word_id IN (${placeholders(wordIds.length)})`,
      wordIds,
    );
  }
}

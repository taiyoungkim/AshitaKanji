// Design Ref: §3.2 / §3 session — SQLite 구현 (세션 생명주기).

import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  SessionEndReason,
  SessionMode,
  SessionRecord,
} from '~/types/Session';
import type { SessionRepo } from '../SessionRepo';

interface SessionRow {
  id: number;
  mode: string;
  started_at: number;
  ended_at: number | null;
  ended_reason: string | null;
  planned_new: number | null;
  planned_review: number | null;
  planned_scan: number | null;
  done_new: number;
  done_review: number;
  done_scan: number;
  again_count: number;
}

function rowToSession(r: SessionRow): SessionRecord {
  return {
    id: r.id,
    mode: r.mode as SessionMode,
    started_at: r.started_at,
    ended_at: r.ended_at,
    ended_reason: (r.ended_reason as SessionEndReason | null) ?? null,
    planned_new: r.planned_new,
    planned_review: r.planned_review,
    planned_scan: r.planned_scan,
    done_new: r.done_new,
    done_review: r.done_review,
    done_scan: r.done_scan,
    again_count: r.again_count,
  };
}

// patch 가능 컬럼 화이트리스트 (SQL injection 방지 + id 변경 차단).
const UPDATABLE: (keyof SessionRecord)[] = [
  'mode',
  'started_at',
  'ended_at',
  'ended_reason',
  'planned_new',
  'planned_review',
  'planned_scan',
  'done_new',
  'done_review',
  'done_scan',
  'again_count',
];

export class SqliteSessionRepo implements SessionRepo {
  constructor(private readonly db: SQLiteDatabase) {}

  async create(rec: SessionRecord): Promise<number> {
    const res = await this.db.runAsync(
      `INSERT INTO session
        (mode, started_at, ended_at, ended_reason, planned_new, planned_review,
         planned_scan, done_new, done_review, done_scan, again_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rec.mode,
        rec.started_at,
        rec.ended_at ?? null,
        rec.ended_reason ?? null,
        rec.planned_new ?? null,
        rec.planned_review ?? null,
        rec.planned_scan ?? null,
        rec.done_new,
        rec.done_review,
        rec.done_scan,
        rec.again_count,
      ],
    );
    return res.lastInsertRowId;
  }

  async update(id: number, patch: Partial<SessionRecord>): Promise<void> {
    const cols: string[] = [];
    const vals: (string | number | null)[] = [];
    for (const key of UPDATABLE) {
      if (key in patch && patch[key] !== undefined) {
        cols.push(`${key} = ?`);
        vals.push((patch[key] ?? null) as string | number | null);
      }
    }
    if (cols.length === 0) return;
    vals.push(id);
    await this.db.runAsync(
      `UPDATE session SET ${cols.join(', ')} WHERE id = ?`,
      vals,
    );
  }

  async findById(id: number): Promise<SessionRecord | null> {
    const row = await this.db.getFirstAsync<SessionRow>(
      `SELECT * FROM session WHERE id = ?`,
      [id],
    );
    return row ? rowToSession(row) : null;
  }

  async findAll(): Promise<SessionRecord[]> {
    const rows = await this.db.getAllAsync<SessionRow>(
      `SELECT * FROM session ORDER BY started_at ASC`,
    );
    return rows.map(rowToSession);
  }
}

// Design Ref: §8 Test Plan — In-memory test double for ScanResultRepo.

import type { ScanResultRecord } from '~/types/ScanResult';
import type { ScanResultRepo } from '../ScanResultRepo';

export class InMemoryScanResultRepo implements ScanResultRepo {
  private rows: ScanResultRecord[] = [];
  private seq = 0;

  async record(rec: ScanResultRecord): Promise<void> {
    // 동일 (session_id, word_id) 제거 후 삽입.
    this.rows = this.rows.filter(
      (r) => !(r.word_id === rec.word_id && r.session_id === (rec.session_id ?? null)),
    );
    this.rows.push({ ...rec, id: ++this.seq });
  }

  async findBySession(sessionId: number): Promise<ScanResultRecord[]> {
    return this.rows.filter((r) => r.session_id === sessionId);
  }

  async findUnpromotedWeak(): Promise<ScanResultRecord[]> {
    return this.rows
      .filter(
        (r) =>
          (r.result === 'confused' || r.result === 'unknown') &&
          r.promoted_to_srs === 0,
      )
      .sort((a, b) => b.scanned_at - a.scanned_at);
  }

  async markPromoted(wordIds: string[]): Promise<void> {
    const set = new Set(wordIds);
    for (const r of this.rows) {
      if (set.has(r.word_id)) r.promoted_to_srs = 1;
    }
  }

  /** 테스트 헬퍼(동기). */
  all(): ScanResultRecord[] {
    return [...this.rows];
  }
}

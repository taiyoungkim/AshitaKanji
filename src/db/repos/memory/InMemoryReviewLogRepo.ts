// Design Ref: §8 Test Plan — In-memory test double for ReviewLogRepo.

import type { ReviewLogRecord } from '~/types/ReviewLog';
import type { ReviewLogRepo } from '../ReviewLogRepo';

export class InMemoryReviewLogRepo implements ReviewLogRepo {
  private logs: ReviewLogRecord[] = [];
  private seq = 0;

  async insert(log: ReviewLogRecord): Promise<number> {
    const id = ++this.seq;
    this.logs.push({ ...log, id });
    return id;
  }

  async findBySession(sessionId: number): Promise<ReviewLogRecord[]> {
    return this.logs.filter((l) => l.session_id === sessionId);
  }

  async findAll(): Promise<ReviewLogRecord[]> {
    return [...this.logs];
  }

  async findSince(sinceMs: number): Promise<ReviewLogRecord[]> {
    return this.logs.filter((l) => l.reviewed_at >= sinceMs);
  }

  /** 테스트 헬퍼(동기): 전체 로그. */
  all(): ReviewLogRecord[] {
    return [...this.logs];
  }
}

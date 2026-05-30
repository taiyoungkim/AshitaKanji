// Design Ref: §3.2 / §3 review_log — 등급 이력 (FSRS 감사 + undo + 통계 소스)

import type { ReviewLogRecord } from '~/types/ReviewLog';

export interface ReviewLogRepo {
  /** 로그 1건 삽입. 반환 = autoincrement id. */
  insert(log: ReviewLogRecord): Promise<number>;
  findBySession(sessionId: number): Promise<ReviewLogRecord[]>;
  /** 전체 로그 (통계 rollup 소스). MVP 규모(수천 건)에선 충분. */
  findAll(): Promise<ReviewLogRecord[]>;
  /** reviewed_at >= sinceMs 로그 (약점 큐: 최근 7일 Again 산정). */
  findSince(sinceMs: number): Promise<ReviewLogRecord[]>;
}

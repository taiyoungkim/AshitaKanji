// Design Ref: §3.2 Repository — daily_stats 테이블 (lazy rollup 저장소).

import type { DailyStats } from '~/types/DailyStats';

export interface DailyStatsRepo {
  /** 날짜 키 기준 삽입/대체 (rollup 재계산 idempotent). */
  upsert(row: DailyStats): Promise<void>;
  findByDate(date: string): Promise<DailyStats | null>;
  /** [startDate, endDate] 포함 범위, 날짜 오름차순. */
  findRange(startDate: string, endDate: string): Promise<DailyStats[]>;
  /** 전체 행, 날짜 오름차순. */
  findAll(): Promise<DailyStats[]>;
}

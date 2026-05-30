// Design Ref: §3 daily_stats — lazy rollup (자정 cron 없음, 재계산 idempotent).
// Plan SC: 진행도/회독/streak 표시. 학습 데이터 외부 전송 0 (전부 로컬 집계).

/** daily_stats 테이블 1행 — 로컬 날짜(YYYY-MM-DD) 기준 집계. */
export interface DailyStats {
  date: string; // 로컬 YYYY-MM-DD
  new_count: number;
  review_count: number;
  scan_count: number; // module-5 (미구현) — MVP 0.
  scan_promoted_count: number;
  again_count: number;
  good_easy_count: number;
  total_time_sec: number;
  session_count: number;
  completed_session_count: number;
  avg_reveal_ms: number | null;
}

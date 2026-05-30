// Design Ref: §3 Data Model — review_log table
// Plan Ref: §9 DB schema
//
// Every grade submission is logged. Used for:
//   - FSRS algorithm verification
//   - Undo (last review can be reverted)
//   - Stats lazy rollup (daily_stats source of truth)
//   - Debugging
//
// reveal_ms: from kanji-face shown to first reveal tap.
// Anti-metric: < 1s = active recall failure (consider forcing reveal delay).

import type { CardState } from './Card';
import type { Grade } from './Grade';

export interface ReviewLogRecord {
  id?: number;                 // autoincrement, undefined on insert
  word_id: string;
  reviewed_at: number;         // unix ms
  grade: Grade;
  state_before: CardState | null;
  state_after: CardState;
  scheduled_days: number;
  elapsed_days: number;
  stability_after: number;
  difficulty_after: number;
  reveal_ms: number | null;    // null if user did not tap reveal (e.g., Again immediately)
  session_id: number | null;
}

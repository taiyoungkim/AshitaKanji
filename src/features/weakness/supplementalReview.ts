import type { UserCard } from '~/types/Card';
import type { Grade } from '~/types/Grade';
import type { ReviewLogRecord } from '~/types/ReviewLog';

const DAY_MS = 86_400_000;

/** 기존 FSRS 상태를 바꾸지 않는 보강 복습 로그. */
export function createSupplementalReviewLog(
  card: UserCard,
  grade: Grade,
  reviewedAt: number,
  revealMs: number | null,
  sessionId: number | null,
): ReviewLogRecord {
  return {
    word_id: card.word_id,
    reviewed_at: reviewedAt,
    grade,
    state_before: card.state,
    state_after: card.state,
    scheduled_days: card.scheduled_days,
    elapsed_days: Math.max(0, Math.floor((reviewedAt - card.last_review) / DAY_MS)),
    stability_after: card.stability,
    difficulty_after: card.difficulty,
    reveal_ms: revealMs,
    session_id: sessionId,
    scheduling_applied: 0,
  };
}

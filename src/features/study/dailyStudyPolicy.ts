// Daily workload policy: never defer due reviews, but stop adding new cards
// when the review backlog would push the session far beyond the chosen pace.

/** A normal day may contain up to roughly 3x the new-card setting in total work. */
export const DAILY_STUDY_BUDGET_MULTIPLIER = 3;

export function calculateDailyNewAllowance(
  dailyNewLimit: number,
  dueReviewCount: number,
): number {
  const newLimit = Math.max(0, Math.floor(dailyNewLimit));
  const due = Math.max(0, Math.floor(dueReviewCount));
  const totalBudget = newLimit * DAILY_STUDY_BUDGET_MULTIPLIER;
  return Math.min(newLimit, Math.max(0, totalBudget - due));
}

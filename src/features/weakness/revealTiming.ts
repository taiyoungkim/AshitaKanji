/** 카드가 표시된 시점부터 최초 정답 공개까지의 능동 회상 시간을 계산한다. */
export function measureRevealLatency(
  cardShownAtMs: number | null,
  revealedAtMs: number,
): number | null {
  if (cardShownAtMs == null) return null;
  return Math.max(0, revealedAtMs - cardShownAtMs);
}

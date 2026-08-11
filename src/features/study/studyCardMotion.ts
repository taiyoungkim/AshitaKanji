/** 공개 전 표제어 묶음을 카드 중앙으로 옮기는 거리. */
export function getCenteredPromptOffset(
  viewportHeight: number,
  promptHeight: number,
  revealedTop: number,
): number {
  if (viewportHeight <= 0 || promptHeight <= 0) return 0;
  return Math.max(0, (viewportHeight - promptHeight) / 2 - revealedTop);
}

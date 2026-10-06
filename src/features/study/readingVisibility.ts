/** 뜻 공개 후에는 항상 읽는 법을 보이고, 공개 전에는 사용자 설정을 따른다. */
export function shouldShowReading(
  revealed: boolean,
  showReadingBeforeReveal: boolean,
): boolean {
  return revealed || showReadingBeforeReveal;
}

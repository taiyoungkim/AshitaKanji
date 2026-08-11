interface RevealStudyCardOptions {
  alreadyRevealed: boolean;
  ttsEnabled: boolean;
  autoPlayWordTts: boolean;
  onReveal: () => void;
  onSpeakWord: () => void;
}

/** 최초 뜻 공개에서만 카드 상태를 바꾸고, 설정에 따라 단어 음성을 한 번 재생한다. */
export function revealStudyCard({
  alreadyRevealed,
  ttsEnabled,
  autoPlayWordTts,
  onReveal,
  onSpeakWord,
}: RevealStudyCardOptions): boolean {
  if (alreadyRevealed) return false;

  onReveal();
  if (ttsEnabled && autoPlayWordTts) onSpeakWord();
  return true;
}

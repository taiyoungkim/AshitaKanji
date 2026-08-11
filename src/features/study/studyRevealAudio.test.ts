import { describe, expect, it, vi } from 'vitest';
import { revealStudyCard } from './studyRevealAudio';

describe('revealStudyCard', () => {
  it('뜻을 처음 공개하면 단어 음성을 한 번 재생한다', () => {
    const onReveal = vi.fn();
    const onSpeakWord = vi.fn();

    const changed = revealStudyCard({
      alreadyRevealed: false,
      ttsEnabled: true,
      autoPlayWordTts: true,
      onReveal,
      onSpeakWord,
    });

    expect(changed).toBe(true);
    expect(onReveal).toHaveBeenCalledOnce();
    expect(onSpeakWord).toHaveBeenCalledOnce();
  });

  it.each([
    { name: '자동 재생 설정이 꺼져 있으면', ttsEnabled: true, autoPlayWordTts: false },
    { name: '전체 TTS가 꺼져 있으면', ttsEnabled: false, autoPlayWordTts: true },
  ])('$name 뜻만 공개한다', ({ ttsEnabled, autoPlayWordTts }) => {
    const onReveal = vi.fn();
    const onSpeakWord = vi.fn();

    revealStudyCard({
      alreadyRevealed: false,
      ttsEnabled,
      autoPlayWordTts,
      onReveal,
      onSpeakWord,
    });

    expect(onReveal).toHaveBeenCalledOnce();
    expect(onSpeakWord).not.toHaveBeenCalled();
  });

  it('이미 공개된 카드를 다시 눌러도 공개와 음성을 중복 실행하지 않는다', () => {
    const onReveal = vi.fn();
    const onSpeakWord = vi.fn();

    const changed = revealStudyCard({
      alreadyRevealed: true,
      ttsEnabled: true,
      autoPlayWordTts: true,
      onReveal,
      onSpeakWord,
    });

    expect(changed).toBe(false);
    expect(onReveal).not.toHaveBeenCalled();
    expect(onSpeakWord).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from 'vitest';
import { getCenteredPromptOffset } from './studyCardMotion';

describe('getCenteredPromptOffset', () => {
  it('moves the unrevealed prompt to the viewport center', () => {
    const viewportHeight = 600;
    const promptHeight = 100;
    const revealedTop = 120;

    const offset = getCenteredPromptOffset(viewportHeight, promptHeight, revealedTop);

    expect(revealedTop + offset + promptHeight / 2).toBe(viewportHeight / 2);
  });

  it('never moves the prompt above its revealed position on a short card', () => {
    expect(getCenteredPromptOffset(250, 100, 120)).toBe(0);
  });
});

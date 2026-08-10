import { describe, expect, it } from 'vitest';
import { buildDoneRewardPresentation } from './rewardPresentation';

describe('buildDoneRewardPresentation', () => {
  it('shows an earned ingredient as the primary reward', () => {
    expect(
      buildDoneRewardPresentation({
        ingredientName: '밥',
        onigiriName: '참치마요',
        crafted: false,
        allCollected: false,
        failed: false,
      }),
    ).toEqual({
      overline: '새 재료',
      title: '밥',
      note: '사장이 재료를 하나 건넸어요',
    });
  });

  it('prioritizes the crafted onigiri on the fourth ingredient', () => {
    expect(
      buildDoneRewardPresentation({
        ingredientName: '마요네즈',
        onigiriName: '참치마요',
        crafted: true,
        allCollected: false,
        failed: false,
      }),
    ).toEqual({
      overline: '완성',
      title: '참치마요',
      note: '사장이 오니기리를 하나 완성했어요.',
    });
  });

  it('shows the completed catalog state when no further reward is available', () => {
    const result = buildDoneRewardPresentation({
      ingredientName: null,
      onigiriName: '사장 특선',
      crafted: false,
      allCollected: true,
      failed: false,
    });

    expect(result.overline).toBe('수집 완료');
    expect(result.title).toBe('전부 모았어요');
  });

  it('shows a recoverable message when progress loading fails', () => {
    const result = buildDoneRewardPresentation({
      ingredientName: null,
      onigiriName: '오니기리',
      crafted: false,
      allCollected: false,
      failed: true,
    });

    expect(result.overline).toBe('확인 실패');
    expect(result.title).toBe('보상을 못 읽었어요');
  });
});

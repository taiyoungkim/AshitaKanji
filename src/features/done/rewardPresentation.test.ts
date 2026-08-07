import { describe, expect, it } from 'vitest';
import { buildDoneRewardPresentation } from './rewardPresentation';

describe('buildDoneRewardPresentation', () => {
  it('shows an earned ingredient as the primary reward', () => {
    expect(
      buildDoneRewardPresentation({
        ingredientName: 'RICE',
        onigiriName: 'TUNA MAYO',
        crafted: false,
        allCollected: false,
        failed: false,
      }),
    ).toEqual({
      kicker: 'NEW INGREDIENT',
      title: 'RICE',
      note: '새 재료를 얻었어.',
      catPose: 'make',
    });
  });

  it('prioritizes the crafted onigiri on the fourth ingredient', () => {
    expect(
      buildDoneRewardPresentation({
        ingredientName: 'MAYO',
        onigiriName: 'TUNA MAYO',
        crafted: true,
        allCollected: false,
        failed: false,
      }),
    ).toEqual({
      kicker: 'CRAFTED',
      title: 'TUNA MAYO',
      note: '오니기리가 완성됐어.',
      catPose: 'present',
    });
  });

  it('shows the completed catalog state when no further reward is available', () => {
    const result = buildDoneRewardPresentation({
      ingredientName: null,
      onigiriName: 'SHOP SPECIAL',
      crafted: false,
      allCollected: true,
      failed: false,
    });

    expect(result.kicker).toBe('ALL COLLECTED');
    expect(result.catPose).toBe('present');
  });

  it('shows a recoverable message when progress loading fails', () => {
    const result = buildDoneRewardPresentation({
      ingredientName: null,
      onigiriName: 'ONIGIRI',
      crafted: false,
      allCollected: false,
      failed: true,
    });

    expect(result.kicker).toBe('REWARD ERROR');
    expect(result.title).toBe('보상 확인 실패');
  });
});

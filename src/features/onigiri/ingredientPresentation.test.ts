import { describe, expect, it } from 'vitest';
import { buildIngredientPresentation } from './ingredientPresentation';

const INGREDIENTS = ['RICE', 'SEAWEED', 'TUNA', 'MAYO'] as const;

describe('buildIngredientPresentation', () => {
  it('marks the first ingredient as next before study begins', () => {
    expect(buildIngredientPresentation(INGREDIENTS, 0, false)).toEqual([
      { name: 'RICE', state: 'next' },
      { name: 'SEAWEED', state: 'pending' },
      { name: 'TUNA', state: 'pending' },
      { name: 'MAYO', state: 'pending' },
    ]);
  });

  it('separates acquired, next, and pending ingredients', () => {
    expect(buildIngredientPresentation(INGREDIENTS, 2, false)).toEqual([
      { name: 'RICE', state: 'acquired' },
      { name: 'SEAWEED', state: 'acquired' },
      { name: 'TUNA', state: 'next' },
      { name: 'MAYO', state: 'pending' },
    ]);
  });

  it('marks every ingredient as acquired when completed', () => {
    const result = buildIngredientPresentation(INGREDIENTS, 4, true);

    expect(result.every((ingredient) => ingredient.state === 'acquired')).toBe(true);
  });
});

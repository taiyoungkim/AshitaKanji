export type IngredientVisualState = 'acquired' | 'next' | 'pending';

export interface IngredientPresentation {
  name: string;
  state: IngredientVisualState;
}

export function buildIngredientPresentation(
  ingredients: readonly string[],
  ingredientCount: number,
  completed: boolean,
): IngredientPresentation[] {
  const safeCount = Math.max(0, Math.min(ingredientCount, ingredients.length));

  return ingredients.map((name, index) => ({
    name,
    state:
      completed || index < safeCount
        ? 'acquired'
        : index === safeCount
          ? 'next'
          : 'pending',
  }));
}

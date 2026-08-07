import type { OnigiriProgressEntry } from '~/features/onigiri/progress';

export interface CurrentOrderPresentation {
  label: string;
  value: string;
}

export function buildCurrentOrderPresentation(
  entry: OnigiriProgressEntry,
  allCollected: boolean,
): CurrentOrderPresentation {
  if (allCollected) {
    return {
      label: '수집 상태',
      value: '모든 오니기리 완성',
    };
  }

  const latestIngredient =
    entry.acquiredIngredients[entry.acquiredIngredients.length - 1];
  if (latestIngredient) {
    return {
      label: '최근 획득',
      value: latestIngredient,
    };
  }

  return {
    label: '다음 재료',
    value: entry.nextIngredient ?? '—',
  };
}

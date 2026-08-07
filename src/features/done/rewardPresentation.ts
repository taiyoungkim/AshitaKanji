import type { CatPose } from '~/features/onigiri/types';

export interface DoneRewardPresentation {
  kicker: string;
  title: string;
  note: string;
  catPose: CatPose;
}

export function buildDoneRewardPresentation({
  ingredientName,
  onigiriName,
  crafted,
  allCollected,
  failed,
}: {
  ingredientName: string | null;
  onigiriName: string;
  crafted: boolean;
  allCollected: boolean;
  failed: boolean;
}): DoneRewardPresentation {
  if (failed) {
    return {
      kicker: 'REWARD ERROR',
      title: '보상 확인 실패',
      note: '메뉴에서 진행도를 다시 확인해줘.',
      catPose: 'make',
    };
  }

  if (crafted) {
    return {
      kicker: 'CRAFTED',
      title: onigiriName,
      note: '오니기리가 완성됐어.',
      catPose: 'present',
    };
  }

  if (allCollected) {
    return {
      kicker: 'ALL COLLECTED',
      title: 'ALL ONIGIRI',
      note: '모든 오니기리를 완성했어.',
      catPose: 'present',
    };
  }

  return {
    kicker: 'NEW INGREDIENT',
    title: ingredientName ?? 'NONE',
    note: ingredientName ? '새 재료를 얻었어.' : '이번 세션에는 새 재료가 없어.',
    catPose: 'make',
  };
}

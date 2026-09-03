// 결과 화면 보상 카드 문구.
// 오버라인·제목·한 줄 설명. 영문 라벨은 한국어로 (핸드오프 화면 3).

import type { OnigiriIngredientReward, OnigiriProgressSnapshot } from '~/features/onigiri/progress';

/** 세션 번호가 없으면 지난 보상을 축하하지 않는다. */
export function findRewardForSession(
  progress: OnigiriProgressSnapshot | null,
  sessionId: number | null,
): OnigiriIngredientReward | null {
  const reward = progress?.lastReward ?? null;
  if (!reward || sessionId === null) return null;
  return reward.sessionId === sessionId ? reward : null;
}

export interface DoneRewardPresentation {
  overline: string;
  title: string;
  note: string;
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
      overline: '확인 실패',
      title: '보상을 못 읽었어요',
      note: '메뉴에서 진행도를 다시 확인해 주세요.',
    };
  }

  if (crafted) {
    return {
      overline: '완성',
      title: onigiriName,
      note: '사장이 오니기리를 하나 완성했어요.',
    };
  }

  if (allCollected) {
    return {
      overline: '수집 완료',
      title: '전부 모았어요',
      note: '메뉴 24종을 모두 완성했어요.',
    };
  }

  return {
    overline: '새 재료',
    title: ingredientName ?? '없음',
    note: ingredientName
      ? '사장이 재료를 하나 건넸어요'
      : '이번 세션에는 새 재료가 없어요',
  };
}

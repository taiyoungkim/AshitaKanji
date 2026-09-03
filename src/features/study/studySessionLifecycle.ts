export interface StudySessionLifecycleState {
  engine: unknown | null;
  summary: unknown | null;
  phase: string | null;
  reviewedCount: number;
  abandon: () => Promise<void>;
}

export interface BeforeRemoveEvent {
  preventDefault: () => void;
}

type SubscribeToRouteRemoval = (listener: (event: BeforeRemoveEvent) => void) => () => void;

export function reviewedCountFromSession(
  state: { doneNew: number; doneReview: number } | null,
): number {
  if (!state) return 0;
  return state.doneNew + state.doneReview;
}

/** 실제 채점이 끝난 직후 — endSession 이 끝나기 전에 뒤로 가면 보상이 유실된다. */
export function shouldBlockStudyLeave(state: {
  summary: unknown | null;
  phase: string | null;
  reviewedCount: number;
}): boolean {
  return state.phase === 'done' && state.summary == null && state.reviewedCount > 0;
}

/** 학습 화면이 다시 붙었을 때: 남은 결과는 완료 화면으로, 빈 스토어만 새 세션. */
export function resolveStudyMountAction(state: {
  engine: unknown | null;
  summary: unknown | null;
}): 'start' | 'open-done' | 'keep' {
  if (state.summary) return 'open-done';
  if (!state.engine) return 'start';
  return 'keep';
}

export function shouldAbandonStudySession(state: {
  engine: unknown | null;
  summary: unknown | null;
  phase: string | null;
  reviewedCount: number;
}): boolean {
  if (!state.engine || state.summary) return false;
  if (state.phase === 'done' && state.reviewedCount > 0) return false;
  return true;
}

/**
 * 화면 컴포넌트의 재생성은 세션 종료 사유가 아니다.
 * 실제 내비게이션 라우트가 제거될 때만 미완 세션을 종료한다.
 * 마지막 카드 채점 직후(완료 저장 중)에는 이탈을 막는다.
 */
export function subscribeToStudyRouteRemoval(
  subscribe: SubscribeToRouteRemoval,
  getState: () => StudySessionLifecycleState,
): () => void {
  return subscribe((event) => {
    const state = getState();
    if (shouldBlockStudyLeave(state)) {
      event.preventDefault();
      return;
    }
    if (shouldAbandonStudySession(state)) void state.abandon();
  });
}

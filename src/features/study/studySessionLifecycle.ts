interface StudySessionLifecycleState {
  engine: unknown | null;
  summary: unknown | null;
  abandon: () => Promise<void>;
}

type SubscribeToRouteRemoval = (listener: () => void) => () => void;

/**
 * 화면 컴포넌트의 재생성은 세션 종료 사유가 아니다.
 * 실제 내비게이션 라우트가 제거될 때만 미완 세션을 종료한다.
 */
export function subscribeToStudyRouteRemoval(
  subscribe: SubscribeToRouteRemoval,
  getState: () => StudySessionLifecycleState,
): () => void {
  return subscribe(() => {
    const state = getState();
    if (state.engine && !state.summary) void state.abandon();
  });
}

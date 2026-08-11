import { describe, expect, it, vi } from 'vitest';
import { subscribeToStudyRouteRemoval } from './studySessionLifecycle';

describe('subscribeToStudyRouteRemoval', () => {
  it('화면 재마운트로 구독만 해제될 때는 진행 중 세션을 유지한다', () => {
    const abandon = vi.fn(async () => undefined);
    const unsubscribe = vi.fn();
    let routeRemovalListener: (() => void) | undefined;

    const cleanup = subscribeToStudyRouteRemoval(
      (listener) => {
        routeRemovalListener = listener;
        return unsubscribe;
      },
      () => ({ engine: {}, summary: null, abandon }),
    );

    expect(routeRemovalListener).toBeTypeOf('function');
    expect(abandon).not.toHaveBeenCalled();

    cleanup();

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(abandon).not.toHaveBeenCalled();
  });

  it('실제 라우트가 제거될 때만 진행 중 세션을 종료한다', () => {
    const abandon = vi.fn(async () => undefined);
    let routeRemovalListener: (() => void) | undefined;

    subscribeToStudyRouteRemoval(
      (listener) => {
        routeRemovalListener = listener;
        return () => undefined;
      },
      () => ({ engine: {}, summary: null, abandon }),
    );

    routeRemovalListener?.();

    expect(abandon).toHaveBeenCalledOnce();
  });

  it.each([
    { name: '활성 세션이 없으면', engine: null, summary: null },
    { name: '이미 완료된 세션이면', engine: {}, summary: {} },
  ])('$name 라우트 제거 시에도 중복 종료하지 않는다', ({ engine, summary }) => {
    const abandon = vi.fn(async () => undefined);
    let routeRemovalListener: (() => void) | undefined;

    subscribeToStudyRouteRemoval(
      (listener) => {
        routeRemovalListener = listener;
        return () => undefined;
      },
      () => ({ engine, summary, abandon }),
    );

    routeRemovalListener?.();

    expect(abandon).not.toHaveBeenCalled();
  });
});

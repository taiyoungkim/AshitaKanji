import { describe, expect, it, vi } from 'vitest';
import {
  resolveStudyMountAction,
  reviewedCountFromSession,
  shouldAbandonStudySession,
  shouldBlockStudyLeave,
  subscribeToStudyRouteRemoval,
} from './studySessionLifecycle';

function event() {
  return { preventDefault: vi.fn() };
}

describe('reviewedCountFromSession', () => {
  it('sums new and review grades', () => {
    expect(reviewedCountFromSession({ doneNew: 2, doneReview: 3 })).toBe(5);
    expect(reviewedCountFromSession(null)).toBe(0);
  });
});

describe('shouldBlockStudyLeave', () => {
  it('blocks leave after the last grade until summary exists', () => {
    expect(
      shouldBlockStudyLeave({ summary: null, phase: 'done', reviewedCount: 4 }),
    ).toBe(true);
  });

  it('allows leave when the session never reviewed a card', () => {
    expect(
      shouldBlockStudyLeave({ summary: null, phase: 'done', reviewedCount: 0 }),
    ).toBe(false);
  });

  it('allows leave after endSession has written a summary', () => {
    expect(
      shouldBlockStudyLeave({ summary: {}, phase: 'done', reviewedCount: 4 }),
    ).toBe(false);
  });
});

describe('resolveStudyMountAction', () => {
  it('starts a session only when the store is empty', () => {
    expect(resolveStudyMountAction({ engine: null, summary: null })).toBe('start');
  });

  it('reopens /done instead of starting over when a summary is left behind', () => {
    expect(resolveStudyMountAction({ engine: {}, summary: {} })).toBe('open-done');
    expect(resolveStudyMountAction({ engine: null, summary: {} })).toBe('open-done');
  });

  it('keeps an in-progress session across remounts', () => {
    expect(resolveStudyMountAction({ engine: {}, summary: null })).toBe('keep');
  });
});

describe('subscribeToStudyRouteRemoval', () => {
  it('화면 재마운트로 구독만 해제될 때는 진행 중 세션을 유지한다', () => {
    const abandon = vi.fn(async () => undefined);
    const unsubscribe = vi.fn();
    let routeRemovalListener: ((e: { preventDefault: () => void }) => void) | undefined;

    const cleanup = subscribeToStudyRouteRemoval(
      (listener) => {
        routeRemovalListener = listener;
        return unsubscribe;
      },
      () => ({ engine: {}, summary: null, phase: 'main', reviewedCount: 1, abandon }),
    );

    expect(routeRemovalListener).toBeTypeOf('function');
    expect(abandon).not.toHaveBeenCalled();

    cleanup();

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(abandon).not.toHaveBeenCalled();
  });

  it('실제 라우트가 제거될 때만 진행 중 세션을 종료한다', () => {
    const abandon = vi.fn(async () => undefined);
    let routeRemovalListener: ((e: { preventDefault: () => void }) => void) | undefined;
    const e = event();

    subscribeToStudyRouteRemoval(
      (listener) => {
        routeRemovalListener = listener;
        return () => undefined;
      },
      () => ({ engine: {}, summary: null, phase: 'main', reviewedCount: 1, abandon }),
    );

    routeRemovalListener?.(e);

    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(abandon).toHaveBeenCalledOnce();
  });

  it('마지막 채점 직후 이탈을 막고 abandon 하지 않는다', () => {
    const abandon = vi.fn(async () => undefined);
    let routeRemovalListener: ((e: { preventDefault: () => void }) => void) | undefined;
    const e = event();

    subscribeToStudyRouteRemoval(
      (listener) => {
        routeRemovalListener = listener;
        return () => undefined;
      },
      () => ({ engine: {}, summary: null, phase: 'done', reviewedCount: 3, abandon }),
    );

    routeRemovalListener?.(e);

    expect(e.preventDefault).toHaveBeenCalledOnce();
    expect(abandon).not.toHaveBeenCalled();
    expect(
      shouldAbandonStudySession({
        engine: {},
        summary: null,
        phase: 'done',
        reviewedCount: 3,
      }),
    ).toBe(false);
  });

  it.each([
    { name: '활성 세션이 없으면', engine: null, summary: null, phase: null, reviewedCount: 0 },
    { name: '이미 완료된 세션이면', engine: {}, summary: {}, phase: 'done', reviewedCount: 2 },
  ])('$name 라우트 제거 시에도 중복 종료하지 않는다', ({ engine, summary, phase, reviewedCount }) => {
    const abandon = vi.fn(async () => undefined);
    let routeRemovalListener: ((e: { preventDefault: () => void }) => void) | undefined;

    subscribeToStudyRouteRemoval(
      (listener) => {
        routeRemovalListener = listener;
        return () => undefined;
      },
      () => ({ engine, summary, phase, reviewedCount, abandon }),
    );

    routeRemovalListener?.(event());

    expect(abandon).not.toHaveBeenCalled();
  });
});

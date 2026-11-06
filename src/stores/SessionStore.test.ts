import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionEngine } from '~/features/study/SessionEngine';
import { Grade } from '~/types/Grade';
import { useSessionStore } from './SessionStore';
import { buildSessionEngine } from '~/features/study/buildSessionEngine';
import type { SessionConfig } from '~/types/Session';

vi.mock('~/features/study/buildSessionEngine', () => ({
  buildSessionEngine: vi.fn(),
}));
vi.mock('~/db/open', () => ({
  getWordCount: () => 1,
}));

describe('SessionStore failure recovery', () => {
  beforeEach(() => {
    vi.mocked(buildSessionEngine).mockReset();
    useSessionStore.getState().reset();
  });

  it('releases busy when session initialization fails', async () => {
    vi.mocked(buildSessionEngine).mockRejectedValue(new Error('database unavailable'));
    const config: SessionConfig = {
      levels: ['N5'],
      dailyNewLimit: 12,
      highIntensityAcknowledged: false,
    };

    await expect(useSessionStore.getState().startSession(config)).rejects.toThrow(
      'database unavailable',
    );

    expect(useSessionStore.getState().busy).toBe(false);
    expect(useSessionStore.getState().engine).toBeNull();
  });

  it('releases busy when review persistence fails', async () => {
    const engine = {
      submitGrade: async () => {
        throw new Error('write failed');
      },
    } as unknown as SessionEngine;
    useSessionStore.setState({ engine, reveal: true, lastRevealMs: 500 });

    await expect(useSessionStore.getState().submitGrade(Grade.Good)).rejects.toThrow(
      'write failed',
    );

    expect(useSessionStore.getState().busy).toBe(false);
  });
});

describe('SessionStore two-step learning', () => {
  async function setup(count: number) {
    const { InMemoryCardRepo } = await import('~/db/repos/memory/InMemoryCardRepo');
    const { InMemoryUserCardRepo } = await import('~/db/repos/memory/InMemoryUserCardRepo');
    const { InMemoryReviewLogRepo } = await import('~/db/repos/memory/InMemoryReviewLogRepo');
    const { InMemorySessionRepo } = await import('~/db/repos/memory/InMemorySessionRepo');
    const { FsrsScheduler } = await import('~/srs/FsrsScheduler');
    const { SessionEngine: Engine } = await import('~/features/study/SessionEngine');
    const userCards = new InMemoryUserCardRepo();
    const cards = new InMemoryCardRepo([], (id) => userCards.has(id));
    cards.seed(
      Array.from({ length: count }, (_, i) => ({
        id: `w${i}`, level: 'N5' as const, surface: `w${i}`, reading_kana: 'x', meaning_ko: 'x',
        card_type: 'A' as const, qa_status: 'verified' as const, deprecated: 0 as const, data_version: 1,
      })),
    );
    const sessions = new InMemorySessionRepo();
    const engine = new Engine(
      cards, userCards, new InMemoryReviewLogRepo(), sessions, new FsrsScheduler(),
      (items) => [...items],
    );
    const updateSpy = vi.spyOn(sessions, 'update');
    vi.mocked(buildSessionEngine).mockResolvedValue(engine);
    await useSessionStore.getState().startSession({
      levels: ['N5'], dailyNewLimit: count, highIntensityAcknowledged: false,
    });
    return { sessions, updateSpy };
  }

  beforeEach(() => {
    vi.mocked(buildSessionEngine).mockReset();
    useSessionStore.getState().reset();
  });

  it('saves the session as completed once when the first pass ends, then reuses it at the final step', async () => {
    const { sessions, updateSpy } = await setup(2);
    const store = useSessionStore.getState;
    await store().submitGrade(Grade.Again);
    await store().submitGrade(Grade.Good);

    expect(store().current?.phase).toBe('interim');
    expect(store().summary).toBeNull();
    expect(updateSpy).toHaveBeenCalledTimes(1);
    const id = store().current!.sessionId;
    expect((await sessions.findById(id))?.ended_reason).toBe('completed');

    store().startRecall();
    expect(store().current?.phase).toBe('recall');
    while (store().recallCard) store().submitRecall(true);
    expect(store().current?.phase).toBe('done');

    const summary = await store().endSession('completed');
    expect(summary.sessionId).toBe(id);
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it('leaving during recall keeps the completed record (no abandoned overwrite)', async () => {
    const { sessions, updateSpy } = await setup(3);
    const store = useSessionStore.getState;
    for (let i = 0; i < 3; i += 1) await store().submitGrade(Grade.Again);
    const id = store().current!.sessionId;
    store().startRecall();
    store().submitRecall(false);

    await store().abandon();

    expect(store().engine).toBeNull();
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect((await sessions.findById(id))?.ended_reason).toBe('completed');
  });
});

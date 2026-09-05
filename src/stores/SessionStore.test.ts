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

import { describe, expect, it } from 'vitest';
import { InMemorySessionRepo } from '~/db/repos/memory/InMemorySessionRepo';
import type { SessionRecord } from '~/types/Session';
import {
  INGREDIENTS_PER_ONIGIRI,
  ONIGIRI_CATALOG_SIZE,
  TEMP_ONIGIRI_CATALOG,
} from './catalog';
import {
  OnigiriProgressService,
  computeOnigiriProgress,
} from './progress';

const DAY = 86_400_000;
const START = Date.UTC(2026, 5, 1, 9);

function session(partial: Partial<SessionRecord> = {}): SessionRecord {
  const startedAt = partial.started_at ?? START;
  return {
    mode: 'review',
    started_at: startedAt,
    ended_at: startedAt + 10 * 60_000,
    ended_reason: 'completed',
    planned_new: null,
    planned_review: null,
    planned_scan: null,
    done_new: 1,
    done_review: 0,
    done_scan: 0,
    again_count: 0,
    ...partial,
  };
}

function completedStudySessions(count: number): SessionRecord[] {
  return Array.from({ length: count }, (_, i) =>
    session({
      id: i + 1,
      started_at: START + i * DAY,
      ended_at: START + i * DAY + 10 * 60_000,
    }),
  );
}

describe('computeOnigiriProgress', () => {
  it('starts with the first onigiri in progress and no reward', () => {
    const snapshot = computeOnigiriProgress([]);

    expect(snapshot.totalCount).toBe(ONIGIRI_CATALOG_SIZE);
    expect(snapshot.completedCount).toBe(0);
    expect(snapshot.totalIngredientsEarned).toBe(0);
    expect(snapshot.current.item.id).toBe('onigiri-001');
    expect(snapshot.current.status).toBe('inProgress');
    expect(snapshot.current.ingredientCount).toBe(0);
    expect(snapshot.lastReward).toBeNull();
  });

  it('counts one completed study session as one ingredient', () => {
    const snapshot = computeOnigiriProgress(completedStudySessions(3));

    expect(snapshot.current.item.id).toBe('onigiri-001');
    expect(snapshot.current.ingredientCount).toBe(3);
    expect(snapshot.current.acquiredIngredients).toEqual(['RICE', 'SEAWEED', 'TUNA']);
    expect(snapshot.current.nextIngredient).toBe('MAYO');
    expect(snapshot.lastReward?.ingredient).toBe('TUNA');
    expect(snapshot.lastReward?.crafted).toBe(false);
  });

  it('completes one onigiri every four earned ingredients', () => {
    const sessions = completedStudySessions(INGREDIENTS_PER_ONIGIRI);
    const snapshot = computeOnigiriProgress(sessions);
    const first = snapshot.entries[0]!;
    const second = snapshot.entries[1]!;

    expect(first.status).toBe('completed');
    expect(first.completedAt).toBe(sessions[3]!.ended_at);
    expect(second.status).toBe('inProgress');
    expect(second.ingredientCount).toBe(0);
    expect(snapshot.completedCount).toBe(1);
    expect(snapshot.lastReward?.ingredient).toBe('MAYO');
    expect(snapshot.lastReward?.crafted).toBe(true);
  });

  it('ignores abandoned, scan-only, and empty completed sessions', () => {
    const sessions = [
      session({ id: 1, done_new: 1 }),
      session({ id: 2, ended_reason: 'abandoned', done_new: 3 }),
      session({ id: 3, mode: 'scan', done_new: 0, done_review: 0, done_scan: 50 }),
      session({ id: 4, done_new: 0, done_review: 0 }),
    ];
    const snapshot = computeOnigiriProgress(sessions);

    expect(snapshot.totalIngredientsEarned).toBe(1);
    expect(snapshot.current.acquiredIngredients).toEqual(['RICE']);
  });

  it('sorts reward order by session completion time', () => {
    const later = session({ id: 1, started_at: START + DAY, ended_at: START + DAY + 1000 });
    const earlier = session({ id: 2, started_at: START, ended_at: START + 1000 });
    const snapshot = computeOnigiriProgress([later, earlier]);

    expect(snapshot.totalIngredientsEarned).toBe(2);
    expect(snapshot.lastReward?.sessionId).toBe(1);
    expect(snapshot.lastReward?.ingredient).toBe('SEAWEED');
  });

  it('caps progress at the temporary catalog size', () => {
    const maxIngredients = TEMP_ONIGIRI_CATALOG.length * INGREDIENTS_PER_ONIGIRI;
    const snapshot = computeOnigiriProgress(completedStudySessions(maxIngredients + 2));

    expect(snapshot.totalIngredientsEarned).toBe(maxIngredients);
    expect(snapshot.overflowCompletedSessions).toBe(2);
    expect(snapshot.completedCount).toBe(TEMP_ONIGIRI_CATALOG.length);
    expect(snapshot.current.item.id).toBe('onigiri-024');
    expect(snapshot.current.status).toBe('completed');
    expect(snapshot.lastReward).toBeNull();
  });
});

describe('OnigiriProgressService', () => {
  it('reads sessions through SessionRepo', async () => {
    const repo = new InMemorySessionRepo();
    await repo.create(session({ started_at: START, ended_at: START + 1000 }));
    await repo.create(session({ started_at: START + DAY, ended_at: START + DAY + 1000 }));

    const snapshot = await new OnigiriProgressService(repo).getSnapshot();

    expect(snapshot.totalIngredientsEarned).toBe(2);
    expect(snapshot.current.nextIngredient).toBe('TUNA');
  });
});

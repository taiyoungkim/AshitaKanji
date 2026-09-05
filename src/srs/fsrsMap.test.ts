import { describe, expect, it } from 'vitest';
import type { UserCard } from '~/types/Card';
import { toFsrsCard, toUserCard } from './fsrsMap';

describe('FSRS-6 card mapping', () => {
  it('adapts a legacy persisted card without learning_steps', () => {
    const legacy: UserCard = {
      word_id: 'legacy',
      difficulty: 5,
      stability: 12,
      scheduled_days: 10,
      elapsed_days: 10,
      reps: 4,
      lapses: 1,
      last_review: 1_700_000_000_000,
      due: 1_700_864_000_000,
      state: 'review',
      note: 'keep',
      leech: 1,
    };

    const fsrs6 = toFsrsCard(legacy);
    const restored = toUserCard(legacy.word_id, fsrs6, legacy);

    expect(fsrs6.learning_steps).toBe(0);
    expect(restored).toEqual(legacy);
  });
});

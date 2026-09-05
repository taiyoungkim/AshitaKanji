// Persists one FSRS state transition as a single unit.

import type { UserCard } from '~/types/Card';
import type { ReviewLogRecord } from '~/types/ReviewLog';
import type { ReviewLogRepo } from './ReviewLogRepo';
import type { UserCardRepo } from './UserCardRepo';

export interface ReviewWriter {
  save(card: UserCard, log: ReviewLogRecord): Promise<number>;
}

/** In-memory/test fallback. Runtime SQLite wiring uses SqliteReviewWriter. */
export class RepositoryReviewWriter implements ReviewWriter {
  constructor(
    private readonly userCards: UserCardRepo,
    private readonly reviewLogs: ReviewLogRepo,
  ) {}

  async save(card: UserCard, log: ReviewLogRecord): Promise<number> {
    await this.userCards.upsert(card);
    return this.reviewLogs.insert(log);
  }
}

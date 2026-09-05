import type { SQLiteDatabase } from 'expo-sqlite';
import type { UserCard } from '~/types/Card';
import type { ReviewLogRecord } from '~/types/ReviewLog';
import type { ReviewWriter } from '../ReviewWriter';
import { SqliteReviewLogRepo } from './SqliteReviewLogRepo';
import { SqliteUserCardRepo } from './SqliteUserCardRepo';

/** Card state and its audit log must commit or roll back together. */
export class SqliteReviewWriter implements ReviewWriter {
  constructor(private readonly db: SQLiteDatabase) {}

  async save(card: UserCard, log: ReviewLogRecord): Promise<number> {
    let logId = 0;
    await this.db.withTransactionAsync(async () => {
      await new SqliteUserCardRepo(this.db).upsert(card);
      logId = await new SqliteReviewLogRepo(this.db).insert(log);
    });
    return logId;
  }
}

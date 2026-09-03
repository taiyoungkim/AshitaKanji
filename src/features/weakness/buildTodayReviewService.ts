import { getDatabase } from '~/db/open';
import { SqliteCardRepo } from '~/db/repos/sqlite/SqliteCardRepo';
import { SqliteReviewLogRepo } from '~/db/repos/sqlite/SqliteReviewLogRepo';
import { SqliteSessionRepo } from '~/db/repos/sqlite/SqliteSessionRepo';
import { SqliteUserCardRepo } from '~/db/repos/sqlite/SqliteUserCardRepo';
import { FsrsScheduler } from '~/srs/FsrsScheduler';
import { TodayReviewService } from './TodayReviewService';

export async function buildTodayReviewService(): Promise<TodayReviewService> {
  const db = await getDatabase();
  return new TodayReviewService(
    new SqliteReviewLogRepo(db),
    new SqliteUserCardRepo(db),
    new SqliteCardRepo(db),
    new SqliteSessionRepo(db),
    new FsrsScheduler(),
  );
}

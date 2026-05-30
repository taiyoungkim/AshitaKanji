// Design Ref: §2.2 의존성 흐름 — SQLite repos 로 StatsRollupService 조립.

import { getDatabase } from '~/db/open';
import { SqliteCardRepo } from '~/db/repos/sqlite/SqliteCardRepo';
import { SqliteDailyStatsRepo } from '~/db/repos/sqlite/SqliteDailyStatsRepo';
import { SqliteReviewLogRepo } from '~/db/repos/sqlite/SqliteReviewLogRepo';
import { SqliteSessionRepo } from '~/db/repos/sqlite/SqliteSessionRepo';
import { SqliteUserCardRepo } from '~/db/repos/sqlite/SqliteUserCardRepo';
import { StatsRollupService } from './StatsRollupService';

/** 앱 런타임용 StatsRollupService 조립 (SQLite 백엔드). */
export async function buildStatsService(): Promise<StatsRollupService> {
  const db = await getDatabase();
  return new StatsRollupService(
    new SqliteReviewLogRepo(db),
    new SqliteSessionRepo(db),
    new SqliteDailyStatsRepo(db),
    new SqliteCardRepo(db),
    new SqliteUserCardRepo(db),
  );
}

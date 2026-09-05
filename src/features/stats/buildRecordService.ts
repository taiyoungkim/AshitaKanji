// Design Ref: §2.2 의존성 흐름 — SQLite repos 로 RecordService 조립.

import { getDatabase } from '~/db/open';
import { SqliteCardRepo } from '~/db/repos/sqlite/SqliteCardRepo';
import { SqliteDailyStatsRepo } from '~/db/repos/sqlite/SqliteDailyStatsRepo';
import { SqliteReviewLogRepo } from '~/db/repos/sqlite/SqliteReviewLogRepo';
import { SqliteScanResultRepo } from '~/db/repos/sqlite/SqliteScanResultRepo';
import { SqliteSessionRepo } from '~/db/repos/sqlite/SqliteSessionRepo';
import { SqliteUserCardRepo } from '~/db/repos/sqlite/SqliteUserCardRepo';
import { RecordService } from './RecordService';
import { StatsRollupService } from './StatsRollupService';

/** 앱 런타임용 RecordService 조립 (SQLite 백엔드). */
export async function buildRecordService(): Promise<RecordService> {
  const db = await getDatabase();
  const reviewLogs = new SqliteReviewLogRepo(db);
  const sessions = new SqliteSessionRepo(db);
  const rollup = new StatsRollupService(
    reviewLogs,
    sessions,
    new SqliteDailyStatsRepo(db),
    new SqliteCardRepo(db),
    new SqliteUserCardRepo(db),
    new SqliteScanResultRepo(db),
  );
  return new RecordService(sessions, reviewLogs, rollup);
}

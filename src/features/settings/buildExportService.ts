// Design Ref: §2.2 의존성 흐름 — SQLite repos 로 ExportService 조립.

import { getDatabase } from '~/db/open';
import { SqliteAppMetaRepo } from '~/db/repos/sqlite/SqliteAppMetaRepo';
import { SqliteDailyStatsRepo } from '~/db/repos/sqlite/SqliteDailyStatsRepo';
import { SqliteReviewLogRepo } from '~/db/repos/sqlite/SqliteReviewLogRepo';
import { SqliteUserCardRepo } from '~/db/repos/sqlite/SqliteUserCardRepo';
import { ExportService } from './ExportService';

/** 앱 런타임용 ExportService 조립 (SQLite 백엔드). */
export async function buildExportService(): Promise<ExportService> {
  const db = await getDatabase();
  return new ExportService(
    new SqliteUserCardRepo(db),
    new SqliteDailyStatsRepo(db),
    new SqliteAppMetaRepo(db),
    new SqliteReviewLogRepo(db),
  );
}

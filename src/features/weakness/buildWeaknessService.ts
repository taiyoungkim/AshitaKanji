// Design Ref: §2.2 의존성 흐름 — SQLite repos 로 WeaknessService 조립.

import { getDatabase } from '~/db/open';
import { SqliteCardRepo } from '~/db/repos/sqlite/SqliteCardRepo';
import { SqliteReviewLogRepo } from '~/db/repos/sqlite/SqliteReviewLogRepo';
import { SqliteScanResultRepo } from '~/db/repos/sqlite/SqliteScanResultRepo';
import { SqliteUserCardRepo } from '~/db/repos/sqlite/SqliteUserCardRepo';
import { FsrsScheduler } from '~/srs/FsrsScheduler';
import { WeaknessService } from './WeaknessService';

/** 앱 런타임용 WeaknessService 조립 (SQLite 백엔드). */
export async function buildWeaknessService(): Promise<WeaknessService> {
  const db = await getDatabase();
  return new WeaknessService(
    new SqliteReviewLogRepo(db),
    new SqliteUserCardRepo(db),
    new SqliteScanResultRepo(db),
    new SqliteCardRepo(db),
    new FsrsScheduler(),
  );
}

// Design Ref: §2.2 의존성 흐름 — SQLite repos 로 ScanService 조립.

import { getDatabase } from '~/db/open';
import { SqliteCardRepo } from '~/db/repos/sqlite/SqliteCardRepo';
import { SqliteScanResultRepo } from '~/db/repos/sqlite/SqliteScanResultRepo';
import { SqliteSessionRepo } from '~/db/repos/sqlite/SqliteSessionRepo';
import { SqliteUserCardRepo } from '~/db/repos/sqlite/SqliteUserCardRepo';
import { FsrsScheduler } from '~/srs/FsrsScheduler';
import { ScanService } from './ScanService';

/** 앱 런타임용 ScanService 조립 (SQLite 백엔드). */
export async function buildScanService(): Promise<ScanService> {
  const db = await getDatabase();
  return new ScanService(
    new SqliteCardRepo(db),
    new SqliteScanResultRepo(db),
    new SqliteUserCardRepo(db),
    new SqliteSessionRepo(db),
    new FsrsScheduler(),
  );
}

// Design Ref: §2.2 의존성 흐름 — SQLite repos + FsrsScheduler 로 SessionEngine 조립.
// Presentation(SessionStore)이 직접 repo 구현을 알지 않도록 팩토리로 캡슐화.

import { getDatabase } from '~/db/open';
import { SqliteCardRepo } from '~/db/repos/sqlite/SqliteCardRepo';
import { SqliteUserCardRepo } from '~/db/repos/sqlite/SqliteUserCardRepo';
import { SqliteReviewLogRepo } from '~/db/repos/sqlite/SqliteReviewLogRepo';
import { SqliteSessionRepo } from '~/db/repos/sqlite/SqliteSessionRepo';
import { FsrsScheduler } from '~/srs/FsrsScheduler';
import { SessionEngine } from './SessionEngine';

/** 앱 런타임용 SessionEngine 1개 조립 (SQLite 백엔드). */
export async function buildSessionEngine(): Promise<SessionEngine> {
  const db = await getDatabase();
  return new SessionEngine(
    new SqliteCardRepo(db),
    new SqliteUserCardRepo(db),
    new SqliteReviewLogRepo(db),
    new SqliteSessionRepo(db),
    new FsrsScheduler(),
  );
}

import { getDatabase } from '~/db/open';
import { SqliteSessionRepo } from '~/db/repos/sqlite/SqliteSessionRepo';
import { OnigiriProgressService } from './progress';

export async function buildOnigiriProgressService(): Promise<OnigiriProgressService> {
  const db = await getDatabase();
  return new OnigiriProgressService(new SqliteSessionRepo(db));
}

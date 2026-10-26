import { getDatabase } from '~/db/open';
import { SqliteAppMetaRepo } from '~/db/repos/sqlite/SqliteAppMetaRepo';
import { SqliteCatCardDrawRepo } from '~/db/repos/sqlite/SqliteCatCardDrawRepo';
import { SqliteSessionRepo } from '~/db/repos/sqlite/SqliteSessionRepo';
import { CatCardService } from './CatCardService';

export async function buildCatCardService(): Promise<CatCardService> {
  const db = await getDatabase();
  return new CatCardService(
    new SqliteSessionRepo(db),
    new SqliteCatCardDrawRepo(db),
    new SqliteAppMetaRepo(db),
  );
}

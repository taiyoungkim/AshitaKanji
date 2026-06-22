// One-time on-device migration: repoint user data from legacy word ids
// (`<level>-<seq>-<slug>`) to the stable hash ids (`w_<hash>`).
//
// word.id became a stable content hash (surface+reading). The seed already ships
// the new ids, but an *already-installed* device keeps the old ids in its word
// table AND in user_card / review_log / scan_result / reading_progress. Without
// this remap, hydration adds new-id word rows and deprecates the old ones, leaving
// every existing card pointing at a deprecated old-id word — silently losing the
// user's study progress. This completes the stated goal: level corrections /
// reordering must NOT cost progress.
//
// No hashing on device: the new id for a legacy row is found by matching its
// surface+reading against the freshly-upserted seed rows (which carry the hash id
// computed at build time). This sidesteps any sha256/separator mismatch risk.
//
// MUST run inside the hydration transaction AFTER seed words are upserted (so the
// hash-id rows exist for the FK) and BEFORE legacy words are deprecated.

/** SQL bind values used by the remap (subset of expo-sqlite's SQLiteBindValue). */
export type SqlParam = string | number | null;

/** Minimal async DB surface shared with expo-sqlite's SQLiteDatabase. Params are
 * required (never undefined) so SQLiteDatabase is structurally assignable. */
export interface RemapDb {
  getAllAsync<T>(sql: string, params: SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: SqlParam[]): Promise<T | null>;
  runAsync(sql: string, params: SqlParam[]): Promise<unknown>;
}

export interface RemapStats {
  legacyWords: number;
  remappedWords: number;
  unmatched: number;
  cardsMoved: number;
  cardsMerged: number;
}

interface WordKeyRow {
  id: string;
  surface: string;
  reading_kana: string;
}

const SEP = '\u0001'; // internal join separator (symmetric, not the hash basis)
const key = (surface: string, reading: string) => `${surface}${SEP}${reading}`;

/**
 * Repoint user data from legacy word ids to hash ids, matched by surface+reading.
 * Idempotent: once no non-`w_` word ids remain, it is a no-op. Returns stats.
 */
export async function remapLegacyWordIds(db: RemapDb): Promise<RemapStats> {
  const stats: RemapStats = {
    legacyWords: 0,
    remappedWords: 0,
    unmatched: 0,
    cardsMoved: 0,
    cardsMerged: 0,
  };

  const legacy = await db.getAllAsync<WordKeyRow>(
    `SELECT id, surface, reading_kana FROM word WHERE substr(id, 1, 2) <> 'w_'`,
    [],
  );
  stats.legacyWords = legacy.length;
  if (legacy.length === 0) return stats;

  const hashRows = await db.getAllAsync<WordKeyRow>(
    `SELECT id, surface, reading_kana FROM word WHERE substr(id, 1, 2) = 'w_'`,
    [],
  );
  const newIdByKey = new Map<string, string>();
  for (const r of hashRows) newIdByKey.set(key(r.surface, r.reading_kana), r.id);

  for (const row of legacy) {
    const newId = newIdByKey.get(key(row.surface, row.reading_kana));
    if (!newId || newId === row.id) {
      if (!newId) stats.unmatched += 1;
      continue;
    }
    stats.remappedWords += 1;
    // No PK on word_id — straight repoint.
    await db.runAsync(`UPDATE review_log SET word_id = ? WHERE word_id = ?`, [newId, row.id]);
    await db.runAsync(`UPDATE scan_result SET word_id = ? WHERE word_id = ?`, [newId, row.id]);
    await remapUserCard(db, row.id, newId, stats);
    await remapReadingProgress(db, row.id, newId);
  }

  return stats;
}

/** user_card.word_id is the PK. On collision (user studied both twins of a merged
 * word) keep the more-studied card (higher reps) and drop the other. */
async function remapUserCard(
  db: RemapDb,
  oldId: string,
  newId: string,
  stats: RemapStats,
): Promise<void> {
  const target = await db.getFirstAsync<{ reps: number }>(
    `SELECT reps FROM user_card WHERE word_id = ?`,
    [newId],
  );
  if (!target) {
    const moved = await db.runAsync(`UPDATE user_card SET word_id = ? WHERE word_id = ?`, [
      newId,
      oldId,
    ]);
    // Only count if a row actually moved (the legacy word may have had no card).
    if (rowsChanged(moved)) stats.cardsMoved += 1;
    return;
  }
  const source = await db.getFirstAsync<{ reps: number }>(
    `SELECT reps FROM user_card WHERE word_id = ?`,
    [oldId],
  );
  if (!source) return; // legacy word had no card; nothing to merge
  stats.cardsMerged += 1;
  if (source.reps > target.reps) {
    await db.runAsync(`DELETE FROM user_card WHERE word_id = ?`, [newId]);
    await db.runAsync(`UPDATE user_card SET word_id = ? WHERE word_id = ?`, [newId, oldId]);
  } else {
    await db.runAsync(`DELETE FROM user_card WHERE word_id = ?`, [oldId]);
  }
}

/** reading_progress PK is (word_id, chapter). Merge per chapter, OR-ing `known`. */
async function remapReadingProgress(db: RemapDb, oldId: string, newId: string): Promise<void> {
  const oldRows = await db.getAllAsync<{ chapter: number; known: number }>(
    `SELECT chapter, known FROM reading_progress WHERE word_id = ?`,
    [oldId],
  );
  for (const r of oldRows) {
    const existing = await db.getFirstAsync<{ known: number }>(
      `SELECT known FROM reading_progress WHERE word_id = ? AND chapter = ?`,
      [newId, r.chapter],
    );
    if (!existing) {
      await db.runAsync(
        `UPDATE reading_progress SET word_id = ? WHERE word_id = ? AND chapter = ?`,
        [newId, oldId, r.chapter],
      );
    } else {
      if (r.known === 1 && existing.known === 0) {
        await db.runAsync(
          `UPDATE reading_progress SET known = 1 WHERE word_id = ? AND chapter = ?`,
          [newId, r.chapter],
        );
      }
      await db.runAsync(`DELETE FROM reading_progress WHERE word_id = ? AND chapter = ?`, [
        oldId,
        r.chapter,
      ]);
    }
  }
}

/** expo-sqlite runAsync returns { changes }; node:sqlite adapter may mirror it. */
function rowsChanged(result: unknown): boolean {
  const changes = (result as { changes?: number } | null)?.changes;
  return changes == null || changes > 0;
}

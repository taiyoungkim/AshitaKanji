// Repoint study progress when a retired card has an explicit surviving card.
// Most mappings are spelling corrections; a small number are reviewed card
// consolidations such as the おじ / おじさん family.

import {
  remountWordProgress,
  type RemapDb,
  type RemapStats,
} from './remapLegacyWordIds';
import { WORD_ID_SUCCESSORS } from './wordIdSuccessors.gen';

export const WORD_SUCCESSOR_REMAP_VERSION = '10';

export async function remapSuccessorWordIds(
  db: RemapDb,
  successors: Readonly<Record<string, string>> = WORD_ID_SUCCESSORS,
): Promise<RemapStats> {
  const stats: RemapStats = {
    legacyWords: Object.keys(successors).length,
    remappedWords: 0,
    unmatched: 0,
    cardsMoved: 0,
    cardsMerged: 0,
  };

  for (const [oldId, newId] of Object.entries(successors)) {
    if (!oldId || !newId || oldId === newId) continue;
    const target = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM word WHERE id = ?`,
      [newId],
    );
    if (!target) {
      stats.unmatched += 1;
      continue;
    }
    stats.remappedWords += 1;
    await remountWordProgress(db, oldId, newId, stats);
    await db.runAsync(
      `UPDATE word
       SET deprecated = 1,
           deprecated_reason = COALESCE(deprecated_reason, 'replaced'),
           superseded_by = ?
       WHERE id = ?`,
      [newId, oldId],
    );
  }

  return stats;
}

// Selects cards that consume today's new-card allowance.
// Scan-promoted cards already own a user_card row, so they must be selected
// before fresh words or they are excluded by both the due and fresh queries.

import type { CardRepo } from '~/db/repos/CardRepo';
import type { UserCardRepo } from '~/db/repos/UserCardRepo';
import type { CardWithProgress, JlptLevel, Word } from '~/types/Card';

export interface DailyNewSelection {
  pending: CardWithProgress[];
  fresh: Word[];
}

export async function selectDailyNewCards(
  cardRepo: CardRepo,
  userCardRepo: UserCardRepo,
  levels: readonly JlptLevel[],
  dailyNewLimit: number,
  nowMs: number,
): Promise<DailyNewSelection> {
  if (levels.length === 0 || dailyNewLimit <= 0) return { pending: [], fresh: [] };

  const pendingCards = await userCardRepo.findPendingNew(nowMs);
  const pendingWords = await cardRepo.findByIds(pendingCards.map((card) => card.word_id));
  const wordById = new Map(pendingWords.map((word) => [word.id, word]));
  const levelSet = new Set(levels);

  const pending: CardWithProgress[] = [];
  for (const userCard of pendingCards) {
    if (pending.length >= dailyNewLimit) break;
    const word = wordById.get(userCard.word_id);
    if (
      word &&
      word.deprecated === 0 &&
      word.qa_status === 'verified' &&
      levelSet.has(word.level)
    ) {
      pending.push({ word, userCard });
    }
  }

  const remaining = dailyNewLimit - pending.length;
  if (remaining === 0) return { pending, fresh: [] };

  const fresh = await cardRepo.findNewCandidates([...levels], remaining);
  return { pending, fresh };
}

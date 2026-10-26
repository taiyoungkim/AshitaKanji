import type { CardWithProgress, JlptLevel, UserCard, Word } from '~/types/Card';

/**
 * 현재 선택한 레벨의 FSRS due만 유지한다.
 * 비활성 단어와 다른 레벨을 제외하며 dueCards의 순서는 보존한다.
 */
export function selectDueReviewCards(
  dueCards: readonly UserCard[],
  words: readonly Word[],
  levels: readonly JlptLevel[],
): CardWithProgress[] {
  const wordById = new Map(words.map((word) => [word.id, word]));
  const levelSet = new Set(levels);
  const queue: CardWithProgress[] = [];
  for (const userCard of dueCards) {
    const word = wordById.get(userCard.word_id);
    if (
      word &&
      levelSet.has(word.level) &&
      word.deprecated === 0 &&
      word.qa_status === 'verified'
    ) {
      queue.push({ word, userCard });
    }
  }
  return queue;
}

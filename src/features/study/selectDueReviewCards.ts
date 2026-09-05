import type { CardWithProgress, UserCard, Word } from '~/types/Card';

/**
 * 기존 FSRS due는 선택 레벨과 무관하게 유지한다.
 * 마스터에서 더 이상 출제할 수 없는 단어만 제외하며 dueCards의 순서를 보존한다.
 */
export function selectDueReviewCards(
  dueCards: readonly UserCard[],
  words: readonly Word[],
): CardWithProgress[] {
  const wordById = new Map(words.map((word) => [word.id, word]));
  const queue: CardWithProgress[] = [];
  for (const userCard of dueCards) {
    const word = wordById.get(userCard.word_id);
    if (word && word.deprecated === 0 && word.qa_status === 'verified') {
      queue.push({ word, userCard });
    }
  }
  return queue;
}

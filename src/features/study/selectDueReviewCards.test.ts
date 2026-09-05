import { describe, expect, it } from 'vitest';
import type { UserCard, Word } from '~/types/Card';
import { selectDueReviewCards } from './selectDueReviewCards';

const userCard = (wordId: string): UserCard => ({
  word_id: wordId,
  difficulty: 5,
  stability: 5,
  scheduled_days: 1,
  elapsed_days: 1,
  reps: 1,
  lapses: 0,
  last_review: 0,
  due: 0,
  state: 'review',
  note: null,
  leech: 0,
});

const word = (id: string, level: Word['level'], patch: Partial<Word> = {}): Word => ({
  id,
  level,
  surface: id,
  reading_kana: id,
  meaning_ko: id,
  card_type: 'A',
  qa_status: 'verified',
  deprecated: 0,
  data_version: 1,
  ...patch,
});

describe('selectDueReviewCards', () => {
  it('keeps due cards from every level while excluding inactive words', () => {
    const selected = selectDueReviewCards(
      [userCard('n5'), userCard('n1'), userCard('draft'), userCard('deprecated')],
      [
        word('n5', 'N5'),
        word('n1', 'N1'),
        word('draft', 'N3', { qa_status: 'needs_review' }),
        word('deprecated', 'N4', { deprecated: 1 }),
      ],
    );

    expect(selected.map((card) => card.word.id)).toEqual(['n5', 'n1']);
  });
});

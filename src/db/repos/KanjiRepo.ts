import type { Word } from '~/types/Card';
import type { KanjiForWord } from '~/types/Kanji';

export interface KanjiRepo {
  findForWord(word: Word): Promise<KanjiForWord[]>;
}

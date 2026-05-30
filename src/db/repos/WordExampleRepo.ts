import type { WordExample } from '~/types/WordExample';

export interface WordExampleRepo {
  findForWord(wordId: string, limit?: number): Promise<WordExample[]>;
}

// Design Ref: cat-card-reward §3 — In-memory test double for CatCardDrawRepo.

import type { CatCardDraw } from '~/types/CatCardDraw';
import type { CatCardDrawRepo } from '../CatCardDrawRepo';

export class InMemoryCatCardDrawRepo implements CatCardDrawRepo {
  private rows: CatCardDraw[] = [];
  private seq = 0;

  async findAll(): Promise<CatCardDraw[]> {
    return [...this.rows];
  }

  async insertWithin(
    decide: (existing: readonly CatCardDraw[]) => Omit<CatCardDraw, 'id'> | null,
  ): Promise<CatCardDraw | null> {
    const row = decide([...this.rows]);
    if (row === null) return null;
    const inserted = { ...row, id: ++this.seq };
    this.rows.push(inserted);
    return inserted;
  }
}

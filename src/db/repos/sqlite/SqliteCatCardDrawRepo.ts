// Design Ref: cat-card-reward §1 D4 — SQLite 구현.
// withTransactionAsync 는 같은 연결의 다른 쿼리가 트랜잭션 안으로 끼어들 수 있다.
// 뽑기는 도장 확인과 insert 사이에 다른 뽑기가 끼면 도장이 음수가 되므로 exclusive 를 쓴다.

import type { SQLiteDatabase } from 'expo-sqlite';
import type { CatCardDraw } from '~/types/CatCardDraw';
import type { CatCardDrawRepo } from '../CatCardDrawRepo';

interface CatCardDrawRow {
  id: number;
  card_id: string;
  drawn_at: number;
  duplicate: number;
}

const SELECT_ALL = `SELECT id, card_id, drawn_at, duplicate FROM cat_card_draw ORDER BY drawn_at, id`;

function fromRow(row: CatCardDrawRow): CatCardDraw {
  return { id: row.id, card_id: row.card_id, drawn_at: row.drawn_at, duplicate: row.duplicate === 1 };
}

export class SqliteCatCardDrawRepo implements CatCardDrawRepo {
  constructor(private readonly db: SQLiteDatabase) {}

  async findAll(): Promise<CatCardDraw[]> {
    const rows = await this.db.getAllAsync<CatCardDrawRow>(SELECT_ALL);
    return rows.map(fromRow);
  }

  async insertWithin(
    decide: (existing: readonly CatCardDraw[]) => Omit<CatCardDraw, 'id'> | null,
  ): Promise<CatCardDraw | null> {
    let inserted: CatCardDraw | null = null;
    await this.db.withExclusiveTransactionAsync(async (txn) => {
      const existing = (await txn.getAllAsync<CatCardDrawRow>(SELECT_ALL)).map(fromRow);
      const row = decide(existing);
      if (row === null) return;
      const result = await txn.runAsync(
        `INSERT INTO cat_card_draw (card_id, drawn_at, duplicate) VALUES (?, ?, ?)`,
        [row.card_id, row.drawn_at, row.duplicate ? 1 : 0],
      );
      inserted = { ...row, id: result.lastInsertRowId };
    });
    return inserted;
  }
}

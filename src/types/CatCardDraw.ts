// Design Ref: cat-card-reward §1 D3 — cat_card_draw 1행 = 뽑기 1회 (append-only).

export interface CatCardDraw {
  id?: number;
  /** catalog id (cat-001 ...). 진행도가 매달리므로 바뀌지 않는다. */
  card_id: string;
  drawn_at: number; // unix ms
  /** 이미 보유한 카드를 다시 뽑았는지. */
  duplicate: boolean;
}

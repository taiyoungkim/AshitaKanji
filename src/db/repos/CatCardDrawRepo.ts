// Design Ref: cat-card-reward §1 D3/D4 — cat_card_draw 저장소.

import type { CatCardDraw } from '~/types/CatCardDraw';

export interface CatCardDrawRepo {
  /** 전체 뽑기 기록, drawn_at → id 오름차순. */
  findAll(): Promise<CatCardDraw[]>;
  /**
   * 기존 기록 조회 → decide → insert 를 한 트랜잭션에서 한다.
   * decide 가 null 을 돌려주면 아무것도 쓰지 않는다(도장 부족 등).
   * 버튼 연타로 두 번 불려도 두 번째 호출은 첫 번째 insert 를 본다.
   */
  insertWithin(
    decide: (existing: readonly CatCardDraw[]) => Omit<CatCardDraw, 'id'> | null,
  ): Promise<CatCardDraw | null>;
}

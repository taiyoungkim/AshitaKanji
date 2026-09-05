// Design Ref: §3.2 Repository Interface — user_card 테이블 (FSRS 상태)
// Plan SC: user_card 절대 손실 X (upsert only).

import type { CardState, JlptLevel, UserCard } from '~/types/Card';

export interface UserCardRepo {
  findById(wordId: string): Promise<UserCard | null>;
  /** due <= nowMs 인 복습 대상 (state != 'new'). */
  findAllDue(nowMs: number): Promise<UserCard[]>;
  /** Scan 등에서 미리 SRS에 편입했지만 아직 첫 평가를 받지 않은 신규 카드. */
  findPendingNew(nowMs: number): Promise<UserCard[]>;
  upsert(card: UserCard): Promise<void>;
  markLeech(wordId: string): Promise<void>;
  countByState(state: CardState): Promise<number>;
  /** 활성 검수 단어 중 레벨별 '성숙' 카드 수 (stability >= 기준일). */
  countMatureByLevel(level: JlptLevel): Promise<number>;
  /** 활성 검수 단어 중 레벨별 '학습한' 단어 수 (user_card 존재). */
  countStudiedByLevel(level: JlptLevel): Promise<number>;
  /** leech=1 카드 (약점 큐 소스). */
  findLeeches(): Promise<UserCard[]>;
  /** 전체 user_card (Export dump). */
  findAll(): Promise<UserCard[]>;
}

/** FSRS 안정도(일) 이 값 이상이면 '성숙'(장기기억 도달)으로 간주. */
export const MATURE_STABILITY_DAYS = 21;

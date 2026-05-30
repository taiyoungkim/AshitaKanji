// Design Ref: §3.2 Repository Interface — user_card 테이블 (FSRS 상태)
// Plan SC: user_card 절대 손실 X (upsert only).

import type { CardState, JlptLevel, UserCard } from '~/types/Card';

export interface UserCardRepo {
  findById(wordId: string): Promise<UserCard | null>;
  /** due <= nowMs 인 복습 대상 (state != 'new'). */
  findAllDue(nowMs: number): Promise<UserCard[]>;
  /** 이미 학습 큐에 진입한 모든 word_id (신규 후보 제외용). */
  existingWordIds(): Promise<string[]>;
  upsert(card: UserCard): Promise<void>;
  markLeech(wordId: string): Promise<void>;
  countByState(state: CardState): Promise<number>;
  /** 레벨별 '성숙' 카드 수 (stability >= MATURE_STABILITY_DAYS = 장기기억 도달). word 조인. */
  countMatureByLevel(level: JlptLevel): Promise<number>;
  /** leech=1 카드 (약점 큐 소스). */
  findLeeches(): Promise<UserCard[]>;
  /** 전체 user_card (Export dump). */
  findAll(): Promise<UserCard[]>;
}

/** FSRS 안정도(일) 이 값 이상이면 '성숙'(장기기억 도달)으로 간주. */
export const MATURE_STABILITY_DAYS = 21;

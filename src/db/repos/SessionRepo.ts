// Design Ref: §3.2 / §3 session — 세션 생명주기

import type { SessionRecord } from '~/types/Session';

export interface SessionRepo {
  create(rec: SessionRecord): Promise<number>;
  update(id: number, patch: Partial<SessionRecord>): Promise<void>;
  findById(id: number): Promise<SessionRecord | null>;
  /** 전체 세션 (통계 rollup 소스 — 학습 시간/세션 수). */
  findAll(): Promise<SessionRecord[]>;
}

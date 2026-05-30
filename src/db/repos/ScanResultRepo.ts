// Design Ref: §3.2 / §3 scan_result — 빠른 훑기 분류 결과 접근.
// Service는 interface에만 의존 (SQLite/InMemory 교체).

import type { ScanResultRecord } from '~/types/ScanResult';

export interface ScanResultRepo {
  /** 동일 (session_id, word_id) 기존 분류 제거 후 1건 삽입 (재분류 시 최신만 유지). */
  record(rec: ScanResultRecord): Promise<void>;
  /** 세션 내 분류 결과 (endScan 요약 소스). */
  findBySession(sessionId: number): Promise<ScanResultRecord[]>;
  /** confused/unknown 인데 promoted_to_srs=0 (약점 큐 소스). 최신 우선. */
  findUnpromotedWeak(): Promise<ScanResultRecord[]>;
  /** 주어진 word_id 들의 scan_result 를 promoted_to_srs=1 로 마킹. */
  markPromoted(wordIds: string[]): Promise<void>;
}

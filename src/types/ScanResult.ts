// Design Ref: §3 Data Model — scan_result table + §4.3 ScanService
// Plan Ref: §9 schema. 빠른 훑기 분류 결과 (대량 노출 → 후보만 SRS promote).
//
// 분류 4종: 안다(known)=scan_result만, 헷갈림(confused)/모름(unknown)=SRS 편입 후보,
//          나중에(later)=보류. promoted_to_srs=1 이면 신규 큐 편입 완료.

import type { JlptLevel, Word } from './Card';

export type ScanGrade = 'known' | 'confused' | 'unknown' | 'later';

export interface ScanResultRecord {
  id?: number; // autoincrement, undefined on insert
  word_id: string;
  scanned_at: number; // unix ms
  result: ScanGrade;
  batch_size: number | null; // 50/100/200/300
  promoted_to_srs: 0 | 1;
  session_id: number | null;
}

/** 스캔 진행 상태 (메모리 — 25개 청크 스트리밍). */
export interface ScanSession {
  sessionId: number;
  levels: JlptLevel[];
  batchSize: number;
  cards: Word[]; // 전체 추출 풀 (랜덤, verified)
}

/** endScan 결과 — SRS 편입 추천. */
export interface ScanSummary {
  sessionId: number;
  total: number;
  knownCount: number;
  confusedCount: number;
  unknownCount: number;
  laterCount: number;
  /** SRS 편입 추천 word_ids (모름 우선 → 헷갈림, 기본 30 최대 50). */
  recommendedWordIds: string[];
}

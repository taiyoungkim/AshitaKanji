// Design Ref: §4.2 SessionEngine, §3 Data Model — session table
// Plan SC: "오늘 완료" 정의 = 오늘 큐를 모두 비움

import type { CardWithProgress, JlptLevel } from './Card';

export type SessionMode = 'review' | 'new' | 'scan' | 'weakness';

export type SessionEndReason = 'completed' | 'abandoned' | 'app_killed';

export type SessionPhase = 'main' | 'done';

export interface SessionConfig {
  levels: JlptLevel[];           // 신규 학습 선택 레벨 (기존 due는 전 레벨)
  dailyNewLimit: number;          // 5-50
  /** true if user has already seen "30+ is high intensity" warning */
  highIntensityAcknowledged: boolean;
}

export interface SessionRecord {
  id?: number;
  mode: SessionMode;
  started_at: number;
  ended_at: number | null;
  ended_reason: SessionEndReason | null;
  planned_new: number | null;
  planned_review: number | null;
  planned_scan: number | null;
  done_new: number;
  done_review: number;
  done_scan: number;
  again_count: number;
  /** 오늘 복습처럼 다른 세션에서 파생된 경우 원본 세션 id. */
  source_session_id?: number | null;
}

export interface SessionState {
  sessionId: number;
  phase: SessionPhase;
  mainQueue: CardWithProgress[];     // due review + new (복습 우선)
  currentIndex: number;
  doneNew: number;
  doneReview: number;
  startedAtMs: number;
}

export interface SessionSummary {
  sessionId: number;
  durationSec: number;
  newCount: number;
  reviewCount: number;
  againCount: number;
  goodEasyCount: number;
  streakDays: number;                // 연속 학습일
}

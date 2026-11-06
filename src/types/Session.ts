// Design Ref: §4.2 SessionEngine, §3 Data Model — session table
// Plan SC: "오늘 완료" 정의 = 오늘 큐를 모두 비움

import type { CardWithProgress, JlptLevel } from './Card';

export type SessionMode = 'review' | 'new' | 'scan' | 'weakness';

export type SessionEndReason = 'completed' | 'abandoned' | 'app_killed';

/**
 * main    = 1차 학습(전체 단어 한 번씩, FSRS 기록)
 * interim = 1차 결과 화면(중간 결과 — 최종 완료가 아님)
 * recall  = 2차 기억 확인(FSRS·review_log 미기록, 세션 메모리만)
 * done    = 최종 완료
 */
export type SessionPhase = 'main' | 'interim' | 'recall' | 'done';

export interface SessionConfig {
  levels: JlptLevel[];           // 학습 선택 레벨 (신규와 기존 due 모두 적용)
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
  /** 1차에서 '다시 볼래요'(Again) / '한 번 익혔어요'(Good) 선택 수. */
  firstPassAgain: number;
  firstPassLearned: number;
  /** 2차 기억 확인 큐 — 1차 종료 시 한 번만 계산해 고정한다. */
  recallQueue: CardWithProgress[];
  recallIndex: number;
  recallRemembered: number;
  recallConfused: number;
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

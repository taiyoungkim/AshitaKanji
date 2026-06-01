// Design Ref: §4.2 SessionEngine, §3 Data Model — session table
// Plan SC: "오늘 완료" 정의 = 오늘 큐를 모두 비움

import type { CardWithProgress, JlptLevel } from './Card';

export type SessionMode = 'review' | 'new' | 'scan' | 'weakness';

export type SessionEndReason = 'completed' | 'abandoned' | 'app_killed';

export type SessionPhase = 'main' | 'again' | 'done';

export interface SessionConfig {
  levels: JlptLevel[];           // 학습 선택 레벨 (다중)
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
}

export interface SessionState {
  sessionId: number;
  phase: SessionPhase;
  mainQueue: CardWithProgress[];     // overdue + yesterday + new (Main round)
  againQueue: CardWithProgress[];    // 레거시/실험용: 현재 기본 플로우에서는 즉시 재출제하지 않음
  currentIndex: number;
  doneNew: number;
  doneReview: number;
  /** wordId → count of Again submissions in this session (2 → defer to tomorrow) */
  againSubmissions: Map<string, number>;
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

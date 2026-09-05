// 기록 탭의 view model 타입.
//
// 앱은 로컬 전용이라 모집단 데이터가 없다. 비교는 항상 "내 과거 기록"이며,
// 전체 사용자 백분위 같은 수치를 만들지 않는다.

/** 완료된 한 세션의 점수. 분모는 그 세션의 review_log 수다. */
export interface SessionScore {
  sessionId: number;
  correct: number;
  total: number;
  percent: number;
  endedAt: number;
}

/** 이번 주 월–일 한 칸. */
export interface WeekDayActivity {
  /** 로컬 기준 YYYY-MM-DD. */
  date: string;
  /** 0=월 … 6=일. */
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  active: boolean;
}

export interface RecordTotals {
  learnedWords: number;
  reviews: number;
  scans: number;
  scanPromoted: number;
  again: number;
  completedSessions: number;
}

/**
 * 과거 점수와의 비교.
 * 표본이 3개 미만이면 분포를 그리지 않고 안내만 한다.
 */
export type PersonalComparison =
  | {
      kind: 'ready';
      percentile: number;
      mean: number;
      samples: readonly number[];
    }
  | {
      kind: 'insufficient';
      sampleCount: number;
    };

export interface RecordSnapshot {
  /** null 이면 아직 완료한 학습이 없다 — 오류가 아니라 첫 학습 안내 상태. */
  latest: SessionScore | null;
  streakDays: number;
  week: readonly WeekDayActivity[];
  totals: RecordTotals;
  comparison: PersonalComparison;
}

/** 화면이 명시적으로 렌더하는 네 가지 상태. */
export type RecordViewState =
  | { phase: 'loading' }
  | { phase: 'ready'; snapshot: RecordSnapshot }
  | { phase: 'empty'; snapshot: RecordSnapshot }
  | { phase: 'error'; message: string };

/** 비교 분포를 그리려면 과거 점수가 최소 이만큼 필요하다. */
export const MIN_COMPARISON_SAMPLES = 3;

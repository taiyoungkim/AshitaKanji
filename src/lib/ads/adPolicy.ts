// 광고 빈도 정책 — 전면광고 노출 가능 여부 판단 (순수 로직, RN 의존 0).
// 원칙: 리텐션 > 광고 수익. 학습 습관 형성을 깨지 않는 선에서만 노출.
//
// 캡 규칙:
// - 신규 유저 유예: 첫 실행 후 3일 미만 && 완료 세션 5회 이하 → 미노출
// - 세션 간격: 완료 세션 2회당 최대 1회
// - 시간 간격: 직전 노출 후 10분 경과
// - 일일 상한: 3회

export interface AdState {
  /** 첫 실행 시각 (epoch ms). */
  firstSeenAt: number;
  /** 누적 완료 세션 수. */
  completedSessions: number;
  /** 직전 광고 노출 시각 (epoch ms, 0 = 없음). */
  lastShownAt: number;
  /** 마지막 노출 날짜 (YYYY-MM-DD, 로컬). 일일 카운트 리셋 기준. */
  shownDay: string;
  /** shownDay 기준 노출 횟수. */
  shownTodayCount: number;
  /** 직전 광고 이후 완료한 세션 수. */
  sessionsSinceAd: number;
}

export const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000; // 신규 유저 유예 3일
export const GRACE_SESSIONS = 5; // 유예 기간 내 무광고 세션 수
export const SESSIONS_PER_AD = 2; // 세션 N회당 광고 1회
export const MIN_INTERVAL_MS = 10 * 60 * 1000; // 노출 최소 간격 10분
export const DAILY_CAP = 3; // 일일 최대 노출

export function initialAdState(now: number): AdState {
  return {
    firstSeenAt: now,
    completedSessions: 0,
    lastShownAt: 0,
    shownDay: '',
    shownTodayCount: 0,
    sessionsSinceAd: 0,
  };
}

/** 로컬 기준 YYYY-MM-DD. */
export function dayOf(now: number): string {
  const d = new Date(now);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 현재 상태에서 광고를 노출해도 되는가. (세션 완료 카운트 반영 후 호출) */
export function isEligible(state: AdState, now: number): boolean {
  // 신규 유저 유예 — 기간과 세션 수 둘 다 벗어나야 노출.
  const inGracePeriod =
    now - state.firstSeenAt < GRACE_PERIOD_MS && state.completedSessions <= GRACE_SESSIONS;
  if (inGracePeriod) return false;

  if (state.sessionsSinceAd < SESSIONS_PER_AD) return false;

  if (state.lastShownAt > 0 && now - state.lastShownAt < MIN_INTERVAL_MS) return false;

  const todayCount = state.shownDay === dayOf(now) ? state.shownTodayCount : 0;
  if (todayCount >= DAILY_CAP) return false;

  return true;
}

/** 세션 완료 기록. */
export function recordSessionCompleted(state: AdState): AdState {
  return {
    ...state,
    completedSessions: state.completedSessions + 1,
    sessionsSinceAd: state.sessionsSinceAd + 1,
  };
}

/** 광고 노출 기록. */
export function recordAdShown(state: AdState, now: number): AdState {
  const today = dayOf(now);
  return {
    ...state,
    lastShownAt: now,
    shownDay: today,
    shownTodayCount: state.shownDay === today ? state.shownTodayCount + 1 : 1,
    sessionsSinceAd: 0,
  };
}

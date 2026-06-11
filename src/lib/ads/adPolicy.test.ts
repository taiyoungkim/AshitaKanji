// 광고 빈도 정책 단위 테스트.
// SC: 신규 유예(3일&&5세션), 세션 2회당 1회, 10분 간격, 일일 3회 상한.

import { describe, expect, it } from 'vitest';
import {
  DAILY_CAP,
  GRACE_PERIOD_MS,
  GRACE_SESSIONS,
  MIN_INTERVAL_MS,
  SESSIONS_PER_AD,
  dayOf,
  initialAdState,
  isEligible,
  recordAdShown,
  recordSessionCompleted,
  type AdState,
} from './adPolicy';

const T0 = new Date('2026-06-01T09:00:00').getTime();
const AFTER_GRACE = T0 + GRACE_PERIOD_MS + 1;

/** 유예를 벗어난(기간 경과 + 세션 충분) 노출 가능 기본 상태. */
function eligibleState(overrides: Partial<AdState> = {}): AdState {
  return {
    ...initialAdState(T0),
    completedSessions: GRACE_SESSIONS + SESSIONS_PER_AD,
    sessionsSinceAd: SESSIONS_PER_AD,
    ...overrides,
  };
}

describe('신규 유저 유예', () => {
  it('첫 3일 && 세션 5회 이하면 미노출', () => {
    let s = initialAdState(T0);
    for (let i = 0; i < GRACE_SESSIONS; i++) s = recordSessionCompleted(s);
    expect(isEligible(s, T0 + 1000)).toBe(false);
  });

  it('3일 내라도 세션 수가 유예를 넘으면 노출 가능', () => {
    let s = initialAdState(T0);
    for (let i = 0; i < GRACE_SESSIONS + SESSIONS_PER_AD; i++) s = recordSessionCompleted(s);
    expect(isEligible(s, T0 + 1000)).toBe(true);
  });

  it('3일 경과면 세션 수 무관하게 유예 해제 (단 세션 간격 캡은 적용)', () => {
    let s = initialAdState(T0);
    s = recordSessionCompleted(s);
    s = recordSessionCompleted(s);
    expect(isEligible(s, AFTER_GRACE)).toBe(true);
  });
});

describe('세션 간격 캡', () => {
  it('광고 후 세션 1회로는 미노출, 2회째부터 노출', () => {
    let s = recordAdShown(eligibleState(), AFTER_GRACE);
    const later = AFTER_GRACE + MIN_INTERVAL_MS + 1;
    s = recordSessionCompleted(s);
    expect(isEligible(s, later)).toBe(false);
    s = recordSessionCompleted(s);
    expect(isEligible(s, later)).toBe(true);
  });
});

describe('시간 간격 캡', () => {
  it('직전 노출 후 10분 미만이면 미노출', () => {
    let s = recordAdShown(eligibleState(), AFTER_GRACE);
    s = recordSessionCompleted(s);
    s = recordSessionCompleted(s);
    expect(isEligible(s, AFTER_GRACE + MIN_INTERVAL_MS - 1)).toBe(false);
    expect(isEligible(s, AFTER_GRACE + MIN_INTERVAL_MS + 1)).toBe(true);
  });
});

describe('일일 상한', () => {
  it('같은 날 3회 노출 후엔 미노출, 다음날 리셋', () => {
    let s = eligibleState();
    let t = AFTER_GRACE;
    for (let i = 0; i < DAILY_CAP; i++) {
      expect(isEligible(s, t)).toBe(true);
      s = recordAdShown(s, t);
      s = recordSessionCompleted(s);
      s = recordSessionCompleted(s);
      t += MIN_INTERVAL_MS + 1;
    }
    // 같은 날 4회째 차단. (t가 자정을 안 넘는 전제: 10분 x 3)
    expect(dayOf(t)).toBe(dayOf(AFTER_GRACE));
    expect(isEligible(s, t)).toBe(false);
    // 다음날 리셋.
    const nextDay = t + 24 * 60 * 60 * 1000;
    expect(isEligible(s, nextDay)).toBe(true);
  });
});

describe('recordAdShown', () => {
  it('노출 기록 시 sessionsSinceAd 리셋 + 일일 카운트 증가', () => {
    const s1 = recordAdShown(eligibleState(), AFTER_GRACE);
    expect(s1.sessionsSinceAd).toBe(0);
    expect(s1.shownTodayCount).toBe(1);
    const s2 = recordAdShown(s1, AFTER_GRACE + MIN_INTERVAL_MS);
    expect(s2.shownTodayCount).toBe(2);
  });
});

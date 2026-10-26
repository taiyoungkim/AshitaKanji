// 출석도장 누적 계산. Design Ref: cat-card-reward §1 D1
// 도장은 저장하지 않는다. 완료 세션이 있는 로컬 날짜 수에서 파생하므로 어긋날 수 없다.
// 날짜 경계는 streak(computeStreak)과 같은 dayKey 를 쓴다.

import { dayKey } from '~/features/stats/StatsRollupService';
import type { SessionRecord } from '~/types/Session';

/**
 * epochKey(포함) 이후 완료 세션이 있는 날 수. 같은 날 여러 세션은 1도장.
 * streak 과 달리 하루 빠져도 줄지 않는다 (Plan FR-01).
 */
export function earnedStamps(sessions: readonly SessionRecord[], epochKey: string): number {
  const days = new Set<string>();
  for (const session of sessions) {
    if (session.ended_reason !== 'completed') continue;
    const key = dayKey(session.ended_at ?? session.started_at);
    // YYYY-MM-DD 는 문자열 비교가 곧 날짜 비교다.
    if (key >= epochKey) days.add(key);
  }
  return days.size;
}

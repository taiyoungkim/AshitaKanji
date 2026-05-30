// Design Ref: §3 daily_stats lazy rollup + §11 통계. Plan SC: 진행도/회독/streak.
//
// daily_stats 는 자정 cron 없이 "필요할 때 재계산"(lazy). review_log + session 을
// 원천으로 로컬 날짜별 집계 → daily_stats 에 upsert. 재계산은 idempotent
// (증분이 아니라 원천에서 전량 재집계 → 두 번 돌려도 동일 결과).

import type { JlptLevel } from '~/types/Card';
import { JLPT_LEVELS } from '~/types/Card';
import type { DailyStats } from '~/types/DailyStats';
import type { CardRepo } from '~/db/repos/CardRepo';
import type { DailyStatsRepo } from '~/db/repos/DailyStatsRepo';
import type { ReviewLogRepo } from '~/db/repos/ReviewLogRepo';
import type { SessionRepo } from '~/db/repos/SessionRepo';
import type { UserCardRepo } from '~/db/repos/UserCardRepo';
import { Grade } from '~/types/Grade';

/** unix ms → 로컬 날짜 키 'YYYY-MM-DD'. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** dateKey 에서 n일 뺀 키. */
function shiftDay(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map((s) => Number.parseInt(s, 10));
  const dt = new Date(y!, (m! - 1), d! + deltaDays);
  return dayKey(dt.getTime());
}

function blank(date: string): DailyStats & { _revealSum: number; _revealN: number } {
  return {
    date,
    new_count: 0,
    review_count: 0,
    scan_count: 0,
    scan_promoted_count: 0,
    again_count: 0,
    good_easy_count: 0,
    total_time_sec: 0,
    session_count: 0,
    completed_session_count: 0,
    avg_reveal_ms: null,
    _revealSum: 0,
    _revealN: 0,
  };
}

export interface LevelProgress {
  level: JlptLevel;
  total: number; // 출제 가능 단어 수
  mature: number; // 장기기억 도달(stability>=21d)
}

export interface OverallStats {
  studyDays: number; // 학습 기록이 있는 날 수
  totalNew: number;
  totalReview: number;
  totalAgain: number;
  totalGoodEasy: number;
  totalTimeSec: number;
  /** good_easy / (new+review). 분모 0이면 null. */
  accuracy: number | null;
}

export class StatsRollupService {
  constructor(
    private readonly reviewLogRepo: ReviewLogRepo,
    private readonly sessionRepo: SessionRepo,
    private readonly dailyStatsRepo: DailyStatsRepo,
    private readonly cardRepo: CardRepo,
    private readonly userCardRepo: UserCardRepo,
  ) {}

  /** review_log + session 원천에서 daily_stats 전량 재집계 (idempotent). */
  async rollup(): Promise<void> {
    const logs = await this.reviewLogRepo.findAll();
    const sessions = await this.sessionRepo.findAll();

    const buckets = new Map<string, ReturnType<typeof blank>>();
    const bucket = (date: string) => {
      let b = buckets.get(date);
      if (!b) {
        b = blank(date);
        buckets.set(date, b);
      }
      return b;
    };

    for (const l of logs) {
      const b = bucket(dayKey(l.reviewed_at));
      // 신규 = 첫 노출(state_before 없음 또는 'new').
      const isNew = l.state_before == null || l.state_before === 'new';
      if (isNew) b.new_count += 1;
      else b.review_count += 1;
      if (l.grade === Grade.Again) b.again_count += 1;
      if (l.grade === Grade.Good || l.grade === Grade.Easy) b.good_easy_count += 1;
      if (l.reveal_ms != null) {
        b._revealSum += l.reveal_ms;
        b._revealN += 1;
      }
    }

    for (const s of sessions) {
      const b = bucket(dayKey(s.started_at));
      b.session_count += 1;
      if (s.ended_reason === 'completed') b.completed_session_count += 1;
      if (s.ended_at != null) {
        b.total_time_sec += Math.max(0, Math.round((s.ended_at - s.started_at) / 1000));
      }
    }

    for (const b of buckets.values()) {
      const { _revealSum, _revealN, ...row } = b;
      row.avg_reveal_ms = _revealN > 0 ? _revealSum / _revealN : null;
      await this.dailyStatsRepo.upsert(row);
    }
  }

  /** 오늘부터 거꾸로 연속 학습일 수. 오늘 기록 없으면 어제부터 계산. */
  async getStreak(nowMs: number): Promise<number> {
    const all = await this.dailyStatsRepo.findAll();
    const active = new Set(
      all.filter((d) => d.new_count + d.review_count > 0).map((d) => d.date),
    );
    if (active.size === 0) return 0;

    const today = dayKey(nowMs);
    // 오늘 기록 없으면 어제부터 시작(오늘 아직 학습 안 했어도 streak 유지).
    let cursor = active.has(today) ? today : shiftDay(today, -1);
    let streak = 0;
    while (active.has(cursor)) {
      streak += 1;
      cursor = shiftDay(cursor, -1);
    }
    return streak;
  }

  /** 레벨별 진행도 (전체 출제 단어 대비 성숙 카드). */
  async getLevelProgress(): Promise<LevelProgress[]> {
    const out: LevelProgress[] = [];
    for (const level of JLPT_LEVELS) {
      const [total, mature] = await Promise.all([
        this.cardRepo.countByLevel(level),
        this.userCardRepo.countMatureByLevel(level),
      ]);
      out.push({ level, total, mature });
    }
    return out;
  }

  /** 전체 누적 통계 (daily_stats 합산). */
  async getOverall(): Promise<OverallStats> {
    const all = await this.dailyStatsRepo.findAll();
    let totalNew = 0;
    let totalReview = 0;
    let totalAgain = 0;
    let totalGoodEasy = 0;
    let totalTimeSec = 0;
    let studyDays = 0;
    for (const d of all) {
      const active = d.new_count + d.review_count > 0;
      if (active) studyDays += 1;
      totalNew += d.new_count;
      totalReview += d.review_count;
      totalAgain += d.again_count;
      totalGoodEasy += d.good_easy_count;
      totalTimeSec += d.total_time_sec;
    }
    const reviews = totalNew + totalReview;
    return {
      studyDays,
      totalNew,
      totalReview,
      totalAgain,
      totalGoodEasy,
      totalTimeSec,
      accuracy: reviews > 0 ? totalGoodEasy / reviews : null,
    };
  }
}

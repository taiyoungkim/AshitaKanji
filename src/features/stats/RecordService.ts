// 기록 탭 view model 계산.
//
// 저장소는 각각 한 번씩만 조회하고 나머지는 메모리에서 접는다.
// 세션 수만큼 findBySession 을 부르면 세션이 쌓일수록 화면이 느려진다.

import type { ReviewLogRepo } from '~/db/repos/ReviewLogRepo';
import type { SessionRepo } from '~/db/repos/SessionRepo';
import type { ReviewLogRecord } from '~/types/ReviewLog';
import type { SessionRecord } from '~/types/Session';
import { Grade } from '~/types/Grade';
import { dayKey, type StatsRollupService } from './StatsRollupService';
import { meanScore, percentileAmong } from './recordChart';
import {
  MIN_COMPARISON_SAMPLES,
  type PersonalComparison,
  type RecordSnapshot,
  type RecordTotals,
  type SessionScore,
  type WeekDayActivity,
} from './recordTypes';

/** 정답으로 세는 등급. UI 는 2단계지만 과거 기록에는 Easy 도 남아 있다. */
function isCorrect(grade: Grade): boolean {
  return grade === Grade.Good || grade === Grade.Easy;
}

/** 로컬 기준 월요일 시작 요일 인덱스. */
function mondayIndex(date: Date): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return ((date.getDay() + 6) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

/** 로컬 자정 기준으로 n일 이동한 Date. */
function shiftDays(base: Date, delta: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + delta);
  return d;
}

/**
 * 완료 세션의 점수. 로그가 하나도 없는 세션은 분모가 0이라 점수를 만들 수 없으므로
 * 호출부에서 제외한다(여기서는 null 을 돌려준다).
 */
function scoreOf(session: SessionRecord, logs: readonly ReviewLogRecord[]): SessionScore | null {
  if (session.id == null) return null;
  if (logs.length === 0) return null;
  const correct = logs.filter((l) => isCorrect(l.grade)).length;
  const total = logs.length;
  return {
    sessionId: session.id,
    correct,
    total,
    percent: (correct / total) * 100,
    endedAt: session.ended_at ?? session.started_at,
  };
}

/** ended_at DESC → started_at DESC → id DESC. 같은 시각에 끝난 세션의 순서를 고정한다. */
function byRecency(a: SessionRecord, b: SessionRecord): number {
  const ae = a.ended_at ?? a.started_at;
  const be = b.ended_at ?? b.started_at;
  if (ae !== be) return be - ae;
  if (a.started_at !== b.started_at) return b.started_at - a.started_at;
  return (b.id ?? 0) - (a.id ?? 0);
}

export class RecordService {
  constructor(
    private readonly sessions: SessionRepo,
    private readonly reviewLogs: ReviewLogRepo,
    private readonly rollup: StatsRollupService,
  ) {}

  async load(nowMs: number): Promise<RecordSnapshot> {
    await this.rollup.rollup();

    const [allSessions, allLogs, overall] = await Promise.all([
      this.sessions.findAll(),
      this.reviewLogs.findAll(),
      this.rollup.getOverall(),
    ]);

    const completed = allSessions.filter((s) => s.ended_reason === 'completed');

    // 세션별 로그를 한 번의 순회로 묶는다.
    const logsBySession = new Map<number, ReviewLogRecord[]>();
    for (const log of allLogs) {
      if (log.session_id == null) continue;
      const bucket = logsBySession.get(log.session_id);
      if (bucket) bucket.push(log);
      else logsBySession.set(log.session_id, [log]);
    }

    const ordered = [...completed].sort(byRecency);
    const scores: SessionScore[] = [];
    for (const session of ordered) {
      const logs = session.id == null ? [] : (logsBySession.get(session.id) ?? []);
      const score = scoreOf(session, logs);
      if (score) scores.push(score);
    }

    const latest = scores[0] ?? null;
    // 최신 세션을 뺀 나머지가 비교 대상이다.
    const priorScores = scores.slice(1).map((s) => s.percent);

    return {
      latest,
      streakDays: computeStreak(completed, nowMs),
      week: buildWeek(completed, nowMs),
      totals: {
        learnedWords: overall.totalNew,
        reviews: overall.totalReview,
        scans: overall.totalScan,
        scanPromoted: overall.totalScanPromoted,
        again: overall.totalAgain,
        completedSessions: completed.length,
      } satisfies RecordTotals,
      comparison: buildComparison(latest, priorScores),
    };
  }
}

/**
 * 연속 학습일. 오늘 아직 학습하지 않았어도 어제까지 이어진 기록은 살린다 —
 * 아침에 앱을 열었다고 streak 이 0으로 보이면 안 된다.
 */
export function computeStreak(sessions: readonly SessionRecord[], nowMs: number): number {
  const days = new Set(sessions.map((s) => dayKey(s.ended_at ?? s.started_at)));
  if (days.size === 0) return 0;

  const today = new Date(nowMs);
  const start = days.has(dayKey(today.getTime())) ? 0 : 1;
  // 오늘도 어제도 없으면 끊긴 것이다.
  if (start === 1 && !days.has(dayKey(shiftDays(today, -1).getTime()))) return 0;

  let count = 0;
  for (let offset = start; ; offset += 1) {
    const key = dayKey(shiftDays(today, -offset).getTime());
    if (!days.has(key)) break;
    count += 1;
  }
  return count;
}

/** 이번 주 월–일. 로컬 날짜 경계를 쓴다. */
export function buildWeek(sessions: readonly SessionRecord[], nowMs: number): WeekDayActivity[] {
  const days = new Set(sessions.map((s) => dayKey(s.ended_at ?? s.started_at)));
  const today = new Date(nowMs);
  const monday = shiftDays(today, -mondayIndex(today));

  return Array.from({ length: 7 }, (_, i) => {
    const date = shiftDays(monday, i);
    const key = dayKey(date.getTime());
    return {
      date: key,
      weekday: i as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      active: days.has(key),
    };
  });
}

/** 과거 점수가 충분할 때만 분포를 그린다. */
export function buildComparison(
  latest: SessionScore | null,
  priorScores: readonly number[],
): PersonalComparison {
  if (latest === null || priorScores.length < MIN_COMPARISON_SAMPLES) {
    return { kind: 'insufficient', sampleCount: priorScores.length };
  }
  return {
    kind: 'ready',
    percentile: percentileAmong(latest.percent, priorScores),
    mean: meanScore(priorScores),
    samples: priorScores,
  };
}

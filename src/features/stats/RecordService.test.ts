import { describe, expect, it } from 'vitest';
import { Grade } from '~/types/Grade';
import type { ReviewLogRecord } from '~/types/ReviewLog';
import type { SessionRecord } from '~/types/Session';
import type { ReviewLogRepo } from '~/db/repos/ReviewLogRepo';
import type { SessionRepo } from '~/db/repos/SessionRepo';
import { buildComparison, buildWeek, computeStreak, RecordService } from './RecordService';
import type { StatsRollupService } from './StatsRollupService';

/** 로컬 자정 기준 시각 — 테스트가 실행 시간대에 흔들리지 않게 한다. */
function localTime(daysAgo: number, hour = 12, base = new Date(2026, 7, 12)): number {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - daysAgo, hour);
  return d.getTime();
}

function session(partial: Partial<SessionRecord> & { id: number }): SessionRecord {
  return {
    levels: ['N5'],
    mode: 'daily',
    started_at: partial.ended_at ?? localTime(0),
    ended_at: localTime(0),
    ended_reason: 'completed',
    planned_new: null,
    planned_review: null,
    planned_scan: null,
    done_new: 0,
    done_review: 0,
    done_scan: 0,
    again_count: 0,
    phase: 'done',
    ...partial,
  } as SessionRecord;
}

function log(sessionId: number | null, grade: Grade): ReviewLogRecord {
  return {
    word_id: 'w_x',
    reviewed_at: localTime(0),
    grade,
    state_before: null,
    state_after: 'review',
    scheduled_days: 1,
    elapsed_days: 0,
    stability_after: 1,
    difficulty_after: 5,
    reveal_ms: null,
    session_id: sessionId,
  } as ReviewLogRecord;
}

interface Counts {
  sessions: number;
  logs: number;
  rollup: number;
  overall: number;
}

function makeService(sessions: SessionRecord[], logs: ReviewLogRecord[], counts: Counts) {
  const sessionRepo = {
    findAll: async () => {
      counts.sessions += 1;
      return sessions;
    },
  } as unknown as SessionRepo;

  const logRepo = {
    findAll: async () => {
      counts.logs += 1;
      return logs;
    },
    findBySession: async () => {
      throw new Error('findBySession 을 세션마다 부르면 N+1 이다');
    },
  } as unknown as ReviewLogRepo;

  const rollup = {
    rollup: async () => {
      counts.rollup += 1;
    },
    getOverall: async () => {
      counts.overall += 1;
      return {
        studyDays: 3,
        totalNew: 42,
        totalReview: 17,
        totalScan: 120,
        totalScanPromoted: 18,
        totalAgain: 5,
        totalGoodEasy: 40,
        totalTimeSec: 600,
        accuracy: 0.8,
      };
    },
  } as unknown as StatsRollupService;

  return new RecordService(sessionRepo, logRepo, rollup);
}

describe('RecordService.load', () => {
  it('완료 세션만 점수로 센다', async () => {
    const counts = { sessions: 0, logs: 0, rollup: 0, overall: 0 };
    const svc = makeService(
      [
        session({ id: 1, ended_at: localTime(1) }),
        session({ id: 2, ended_at: localTime(0), ended_reason: 'abandoned' }),
      ],
      [log(1, Grade.Good), log(1, Grade.Again), log(2, Grade.Good)],
      counts,
    );

    const snap = await svc.load(localTime(0));
    expect(snap.latest?.sessionId).toBe(1);
    expect(snap.totals.completedSessions).toBe(1);
  });

  it('로그가 없는 완료 세션은 점수에서 제외한다', async () => {
    const counts = { sessions: 0, logs: 0, rollup: 0, overall: 0 };
    const svc = makeService(
      [session({ id: 1, ended_at: localTime(0) }), session({ id: 2, ended_at: localTime(1) })],
      [log(2, Grade.Good)],
      counts,
    );

    const snap = await svc.load(localTime(0));
    // 더 최근인 1번은 로그가 없어 밀려나고 2번이 최신 점수가 된다.
    expect(snap.latest?.sessionId).toBe(2);
  });

  it('Good 과 Easy 를 정답으로 센다', async () => {
    const counts = { sessions: 0, logs: 0, rollup: 0, overall: 0 };
    const svc = makeService(
      [session({ id: 1 })],
      [log(1, Grade.Good), log(1, Grade.Easy), log(1, Grade.Again), log(1, Grade.Hard)],
      counts,
    );

    const snap = await svc.load(localTime(0));
    expect(snap.latest?.correct).toBe(2);
    expect(snap.latest?.total).toBe(4);
    expect(snap.latest?.percent).toBe(50);
  });

  it('같은 시각에 끝난 세션은 id 로 순서를 가린다', async () => {
    const counts = { sessions: 0, logs: 0, rollup: 0, overall: 0 };
    const same = localTime(0);
    const svc = makeService(
      [
        session({ id: 5, ended_at: same, started_at: same }),
        session({ id: 9, ended_at: same, started_at: same }),
      ],
      [log(5, Grade.Good), log(9, Grade.Good)],
      counts,
    );

    const snap = await svc.load(same);
    expect(snap.latest?.sessionId).toBe(9);
  });

  it('누적 타일은 rollup 의 값을 그대로 쓴다', async () => {
    const counts = { sessions: 0, logs: 0, rollup: 0, overall: 0 };
    const svc = makeService([session({ id: 1 })], [log(1, Grade.Good)], counts);

    const snap = await svc.load(localTime(0));
    expect(snap.totals).toEqual({
      learnedWords: 42,
      reviews: 17,
      scans: 120,
      scanPromoted: 18,
      again: 5,
      completedSessions: 1,
    });
  });

  it('저장소를 각각 한 번씩만 조회한다', async () => {
    const counts = { sessions: 0, logs: 0, rollup: 0, overall: 0 };
    const many = Array.from({ length: 20 }, (_, i) =>
      session({ id: i + 1, ended_at: localTime(i) }),
    );
    const logs = many.map((s) => log(s.id!, Grade.Good));
    const svc = makeService(many, logs, counts);

    await svc.load(localTime(0));
    expect(counts.sessions).toBe(1);
    expect(counts.logs).toBe(1);
    expect(counts.rollup).toBe(1);
    expect(counts.overall).toBe(1);
  });

  it('데이터가 비면 latest 가 null 이다', async () => {
    const counts = { sessions: 0, logs: 0, rollup: 0, overall: 0 };
    const svc = makeService([], [], counts);

    const snap = await svc.load(localTime(0));
    expect(snap.latest).toBeNull();
    expect(snap.streakDays).toBe(0);
    expect(snap.comparison.kind).toBe('insufficient');
  });

  it('저장소 오류는 호출부로 전파한다', async () => {
    const failing = {
      findAll: async () => {
        throw new Error('db down');
      },
    } as unknown as SessionRepo;
    const svc = new RecordService(
      failing,
      { findAll: async () => [] } as unknown as ReviewLogRepo,
      {
        rollup: async () => undefined,
        getOverall: async () => ({
          studyDays: 0,
          totalNew: 0,
          totalReview: 0,
          totalScan: 0,
          totalScanPromoted: 0,
          totalAgain: 0,
          totalGoodEasy: 0,
          totalTimeSec: 0,
          accuracy: null,
        }),
      } as unknown as StatsRollupService,
    );

    await expect(svc.load(localTime(0))).rejects.toThrow('db down');
  });
});

describe('computeStreak', () => {
  it('오늘 포함 연속일을 센다', () => {
    const sessions = [
      session({ id: 1, ended_at: localTime(0) }),
      session({ id: 2, ended_at: localTime(1) }),
      session({ id: 3, ended_at: localTime(2) }),
    ];
    expect(computeStreak(sessions, localTime(0))).toBe(3);
  });

  it('오늘 아직 안 했어도 어제까지 기록을 살린다', () => {
    const sessions = [
      session({ id: 1, ended_at: localTime(1) }),
      session({ id: 2, ended_at: localTime(2) }),
    ];
    expect(computeStreak(sessions, localTime(0))).toBe(2);
  });

  it('이틀 이상 비면 0이다', () => {
    const sessions = [session({ id: 1, ended_at: localTime(3) })];
    expect(computeStreak(sessions, localTime(0))).toBe(0);
  });

  it('기록이 없으면 0이다', () => {
    expect(computeStreak([], localTime(0))).toBe(0);
  });
});

describe('buildWeek', () => {
  it('월요일부터 일요일까지 7칸을 만든다', () => {
    const week = buildWeek([], localTime(0));
    expect(week).toHaveLength(7);
    expect(week[0]?.weekday).toBe(0);
    expect(week[6]?.weekday).toBe(6);
  });

  it('학습한 날만 active 다', () => {
    const now = localTime(0);
    const week = buildWeek([session({ id: 1, ended_at: now })], now);
    const activeDays = week.filter((d) => d.active);
    expect(activeDays).toHaveLength(1);
  });

  it('날짜 경계는 로컬 자정 기준이다', () => {
    // 같은 날 23:59 과 00:01 은 같은 칸에 들어간다.
    const late = localTime(0, 23);
    const early = localTime(0, 0);
    const week = buildWeek(
      [session({ id: 1, ended_at: late }), session({ id: 2, ended_at: early })],
      late,
    );
    expect(week.filter((d) => d.active)).toHaveLength(1);
  });
});

describe('buildComparison', () => {
  const latest = { sessionId: 1, correct: 8, total: 10, percent: 80, endedAt: 0 };

  it('과거 기록이 3개 미만이면 비교하지 않는다', () => {
    expect(buildComparison(latest, [50, 60])).toEqual({ kind: 'insufficient', sampleCount: 2 });
  });

  it('3개 이상이면 퍼센타일과 평균을 낸다', () => {
    const result = buildComparison(latest, [50, 60, 90]);
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.percentile).toBeCloseTo(66.67, 1);
    expect(result.mean).toBeCloseTo(66.67, 1);
  });

  it('동점은 앞선 기록으로 세지 않는다', () => {
    const result = buildComparison(latest, [80, 80, 80]);
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.percentile).toBe(0);
  });

  it('최신 점수가 없으면 비교하지 않는다', () => {
    expect(buildComparison(null, [10, 20, 30, 40]).kind).toBe('insufficient');
  });
});

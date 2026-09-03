import type { SessionRecord } from '~/types/Session';

export type HomePhase =
  | 'studyBefore'
  | 'reviewPending'
  | 'reviewDone'
  | 'noReview'
  | 'allDone';

export interface HomeDayState {
  phase: HomePhase;
  studySessionId: number | null;
  studyCount: number;
  againCount: number;
  durationSec: number;
}

interface Input {
  sessions: readonly SessionRecord[];
  nowMs: number;
  remainingStudyCount: number;
  /** 오늘 완료한 회독 챕터가 있는지. 과거 완료 챕터는 홈 완료로 승격하지 않는다. */
  readingCompleteToday: boolean;
}

function isSameLocalDay(leftMs: number, rightMs: number): boolean {
  const left = new Date(leftMs);
  const right = new Date(rightMs);
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function endedAt(session: SessionRecord): number {
  return session.ended_at ?? session.started_at;
}

/**
 * 최신 홈은 사용자의 수동 탭 선택이 아니라 오늘 완료한 세션으로 상태를 복원한다.
 * `new|review`는 정규 학습, 해당 세션을 출처로 가진 `weakness` 완료는 오늘 복습 완료로 본다.
 */
export function buildHomeDayState({
  sessions,
  nowMs,
  remainingStudyCount,
  readingCompleteToday,
}: Input): HomeDayState {
  const completedToday = sessions
    .filter(
      (session) =>
        session.ended_reason === 'completed' &&
        isSameLocalDay(endedAt(session), nowMs),
    )
    .sort((a, b) => endedAt(b) - endedAt(a));

  const study = completedToday.find(
    (session) => session.mode === 'new' || session.mode === 'review',
  );

  if (!study) {
    return {
      phase: remainingStudyCount === 0 && readingCompleteToday ? 'allDone' : 'studyBefore',
      studySessionId: null,
      studyCount: 0,
      againCount: 0,
      durationSec: 0,
    };
  }

  const studyEnd = endedAt(study);
  const reviewCompleted = completedToday.some(
    (session) =>
      session.mode === 'weakness' &&
      session.source_session_id === study.id &&
      endedAt(session) >= studyEnd,
  );
  const studyCount = study.done_new + study.done_review;
  const durationSec = Math.max(0, Math.round((studyEnd - study.started_at) / 1000));

  let phase: HomePhase;
  if (remainingStudyCount === 0 && readingCompleteToday && (study.again_count === 0 || reviewCompleted)) {
    phase = 'allDone';
  } else if (study.again_count === 0) {
    phase = 'noReview';
  } else if (reviewCompleted) {
    phase = 'reviewDone';
  } else {
    phase = 'reviewPending';
  }

  return {
    phase,
    studySessionId: study.id ?? null,
    studyCount,
    againCount: study.again_count,
    durationSec,
  };
}

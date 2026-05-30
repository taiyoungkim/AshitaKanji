// Design Ref: §4.1 FsrsScheduler — ts-fsrs Card ↔ UserCard 변환 계층
// RISK 완화: ts-fsrs(Date, numeric State enum) ↔ UserCard(unix ms, string state) 매핑 단일화.

import { State, type Card as FsrsCard } from 'ts-fsrs';
import type { CardState, UserCard } from '~/types/Card';

const STATE_TO_STR: Record<number, CardState> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};

const STR_TO_STATE: Record<CardState, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

/** ts-fsrs Card → our UserCard (Date→ms, enum→string). */
export function toUserCard(wordId: string, c: FsrsCard, prev?: UserCard): UserCard {
  return {
    word_id: wordId,
    difficulty: c.difficulty,
    stability: c.stability,
    scheduled_days: c.scheduled_days,
    elapsed_days: c.elapsed_days,
    reps: c.reps,
    lapses: c.lapses,
    last_review: c.last_review ? c.last_review.getTime() : 0,
    due: c.due.getTime(),
    state: STATE_TO_STR[c.state] ?? 'new',
    note: prev?.note ?? null,
    leech: prev?.leech ?? 0,
  };
}

/** our UserCard → ts-fsrs Card (ms→Date, string→enum). */
export function toFsrsCard(u: UserCard): FsrsCard {
  return {
    due: new Date(u.due),
    stability: u.stability,
    difficulty: u.difficulty,
    elapsed_days: u.elapsed_days,
    scheduled_days: u.scheduled_days,
    reps: u.reps,
    lapses: u.lapses,
    state: STR_TO_STATE[u.state],
    last_review: u.last_review ? new Date(u.last_review) : undefined,
  };
}

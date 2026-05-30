// Design Ref: §11 FSRS — 4-grade rating
// Plan SC: Again 세션끝 미니라운드 + 2회 실패 시 내일로
//
// Map to ts-fsrs Rating enum (which uses 1-4).

export const Grade = {
  Again: 1,
  Hard: 2,
  Good: 3,
  Easy: 4,
} as const;

// const + 동명 type 병합 패턴 (의도적) — no-redeclare 오탐 억제.
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Grade = (typeof Grade)[keyof typeof Grade];

export const GRADE_LABELS_KO: Record<Grade, string> = {
  [Grade.Again]: '모름',
  [Grade.Hard]: '어려움',
  [Grade.Good]: '앎',
  [Grade.Easy]: '쉬움',
};

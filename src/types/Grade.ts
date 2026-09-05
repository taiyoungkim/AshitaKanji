// Design Ref: §11 FSRS — 4-grade rating
// Daily-only policy: Again은 같은 세션에 재출제하지 않고 FSRS due 일정으로 이월.
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

/**
 * 학습 UI 는 2단계(아직이에요=Again / 외웠어요=Good)만 노출한다 — Hard/Easy 는
 * 과거 기록과 FSRS 매핑을 위해 타입에 남겨 두되 새로 기록되지 않는다.
 * 라벨은 통계·디버그 표시용.
 */
export const GRADE_LABELS_KO: Record<Grade, string> = {
  [Grade.Again]: '아직이에요',
  [Grade.Hard]: '어려움',
  [Grade.Good]: '외웠어요',
  [Grade.Easy]: '쉬움',
};

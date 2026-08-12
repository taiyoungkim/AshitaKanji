// 학습 시작 경로 판정 — 순수 로직만.
//
// DB 조회는 resolveStudyEntry 가 맡는다. 여기를 분리해 두어야 저장소를 끌어오지 않고
// 판정 규칙만 테스트할 수 있다(vitest 는 순수 TS 만 돌린다).

export interface TodayCounts {
  due: number;
  newAvail: number;
}

export type StudyEntryRoute = '/study' | '/weakness';

/** 큐가 비었으면 약점 복습으로 보낸다 — 막다른 화면을 만들지 않는다. */
export function resolveStudyRoute(counts: TodayCounts): StudyEntryRoute {
  return counts.due + counts.newAvail > 0 ? '/study' : '/weakness';
}

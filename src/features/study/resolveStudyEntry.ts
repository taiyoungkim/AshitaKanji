// 홈과 기록 탭이 공유하는 "학습 시작" 판정의 데이터 조회부.
//
// 두 화면이 각자 큐를 세면 같은 버튼이 서로 다른 곳으로 가는 사고가 난다.
// 판정 규칙 자체는 studyEntryRoute 에 있다.

import { getDatabase } from '~/db/open';
import { SqliteCardRepo } from '~/db/repos/sqlite/SqliteCardRepo';
import { SqliteUserCardRepo } from '~/db/repos/sqlite/SqliteUserCardRepo';
import type { JlptLevel } from '~/types/Card';
import { resolveStudyRoute, type StudyEntryRoute, type TodayCounts } from './studyEntryRoute';

export { resolveStudyRoute } from './studyEntryRoute';
export type { StudyEntryRoute, TodayCounts } from './studyEntryRoute';

/** 선택 레벨의 오늘 복습·신규 후보 수. */
export async function loadTodayCounts(
  levels: JlptLevel[],
  dailyNewLimit: number,
  nowMs: number = Date.now(),
): Promise<TodayCounts> {
  const db = await getDatabase();
  const ucRepo = new SqliteUserCardRepo(db);
  const cardRepo = new SqliteCardRepo(db);

  const due = await ucRepo.findAllDue(nowMs);
  const dueWords = await cardRepo.findByIds(due.map((c) => c.word_id));
  const levelSet = new Set(levels);
  const dueCount = dueWords.filter((w) => w.deprecated === 0 && levelSet.has(w.level)).length;

  const existing = await ucRepo.existingWordIds();
  const newCands = await cardRepo.findNewCandidates(levels, dailyNewLimit, existing);

  return { due: dueCount, newAvail: newCands.length };
}

/** 조회부터 경로 판정까지. 기록 탭 CTA 처럼 카운트가 없는 화면이 쓴다. */
export async function resolveStudyEntry(
  levels: JlptLevel[],
  dailyNewLimit: number,
  nowMs: number = Date.now(),
): Promise<StudyEntryRoute> {
  return resolveStudyRoute(await loadTodayCounts(levels, dailyNewLimit, nowMs));
}

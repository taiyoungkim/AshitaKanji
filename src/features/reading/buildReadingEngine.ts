// 회독 엔진/통계 조립 — Presentation이 repo 구현을 모르게 캡슐화.

import { getDatabase } from '~/db/open';
import { SqliteCardRepo } from '~/db/repos/sqlite/SqliteCardRepo';
import { SqliteReadingProgressRepo } from '~/db/repos/sqlite/SqliteReadingProgressRepo';
import type { JlptLevel } from '~/types/Card';
import type { ChapterStat } from '~/types/Reading';
import { ReadingEngine } from './ReadingEngine';

export async function buildReadingEngine(): Promise<ReadingEngine> {
  const db = await getDatabase();
  return new ReadingEngine(new SqliteCardRepo(db), new SqliteReadingProgressRepo(db));
}

export async function loadLevelChapterStats(level: JlptLevel): Promise<ChapterStat[]> {
  const db = await getDatabase();
  return new SqliteReadingProgressRepo(db).getLevelChapterStats(level);
}

export async function resetReadingChapter(level: JlptLevel, chapter: number): Promise<void> {
  const db = await getDatabase();
  await new SqliteReadingProgressRepo(db).resetChapter(level, chapter);
}

// 누적 회독 횟수는 챕터 진행도로는 나오지 않는다(완료 후 다시 외우기도 1회다).
// 새 테이블 대신 이미 있는 events 로그에 한 줄씩 남긴다.
const READING_PASS_EVENT = 'reading_pass';

export async function recordReadingPass(level: JlptLevel, chapter: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`INSERT INTO events (ts, type, payload) VALUES (?, ?, ?)`, [
    Date.now(),
    READING_PASS_EVENT,
    `${level}-${chapter}`,
  ]);
}

export async function countReadingPasses(level: JlptLevel): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM events WHERE type = ? AND payload LIKE ?`,
    [READING_PASS_EVENT, `${level}-%`],
  );
  return row?.count ?? 0;
}

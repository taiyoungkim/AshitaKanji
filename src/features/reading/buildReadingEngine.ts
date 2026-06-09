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

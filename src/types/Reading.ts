// 회독(read-through) 도메인 타입.
// 챕터 = 레벨 내 빈도순 50단어 묶음 (word.reading_chapter, 동결).

import type { JlptLevel } from './Card';

/** 레벨 챕터별 진행 통계 — total 단어 중 known 개수. */
export interface ChapterStat {
  level: JlptLevel;
  chapter: number;
  total: number;
  known: number;
}

/** 챕터 완료 = known === total (total>0). */
export function isChapterComplete(stat: ChapterStat): boolean {
  return stat.total > 0 && stat.known >= stat.total;
}

export type ChapterStatus = 'locked' | 'inProgress' | 'completed';

/**
 * 순차 해금: 완료된 챕터들 + 첫 미완료 챕터(=현재)만 inProgress, 이후는 locked.
 * stats 는 chapter 오름차순 가정.
 */
export function chapterStatus(stats: ChapterStat[], chapter: number): ChapterStatus {
  const sorted = [...stats].sort((a, b) => a.chapter - b.chapter);
  let current = Infinity;
  for (const s of sorted) {
    if (!isChapterComplete(s)) {
      current = s.chapter;
      break;
    }
  }
  const target = stats.find((s) => s.chapter === chapter);
  if (target && isChapterComplete(target)) return 'completed';
  if (chapter === current) return 'inProgress';
  return chapter < current ? 'completed' : 'locked';
}

// 회독(read-through) 도메인 타입.
// 챕터 = 레벨 내 빈도순 50단어 묶음 (word.reading_chapter, 동결).

import type { JlptLevel } from './Card';

/** 레벨 챕터별 진행 통계. covered는 최초 노출 진도, known은 완료 판정용 숙련도. */
export interface ChapterStat {
  level: JlptLevel;
  chapter: number;
  total: number;
  covered: number;
  known: number;
  /** 이 챕터의 마지막 노출 시각. 홈의 '오늘 회독 완료' 판정에 사용한다. */
  lastUpdatedAt?: number;
}

/** 챕터 완료 = known === total (total>0). */
export function isChapterComplete(stat: ChapterStat): boolean {
  return stat.total > 0 && stat.known >= stat.total;
}

/**
 * 지금 이어서 볼 챕터 — 첫 미완료 챕터. 전부 끝냈으면 마지막 챕터(다시 외우기 대상)를 준다.
 * 홈의 '이어서 회독해요' 카드와 회독 홈의 '현재 회독' 카드가 같은 챕터를 가리켜야 한다.
 */
export function pickCurrentChapter(stats: readonly ChapterStat[]): ChapterStat | null {
  const sorted = [...stats].sort((a, b) => a.chapter - b.chapter);
  return sorted.find((stat) => !isChapterComplete(stat)) ?? sorted.at(-1) ?? null;
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

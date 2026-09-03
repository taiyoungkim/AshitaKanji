// 읽기 진행 저장소 — 최초 노출(seen)과 숙련(known)을 독립 보존한다.
// FSRS(user_card)와 완전 분리된 독립 학습 경로.

import type { JlptLevel } from '~/types/Card';
import type { ChapterStat } from '~/types/Reading';

export interface ReadingProgressRepo {
  /** 독립 챕터 블록의 단어별 노출/숙련 상태. */
  getChapterProgress(level: JlptLevel, chapter: number): Promise<Map<string, ReadingWordProgress>>;
  /** 단어 노출을 기록한다. known=true는 숙련도 함께 올리며, 기존 숙련도는 낮추지 않는다. */
  recordExposure(wordId: string, chapter: number, known: boolean, now?: number): Promise<void>;
  /** 레벨의 독립 챕터별 통계 (chapter 오름차순). */
  getLevelChapterStats(level: JlptLevel): Promise<ChapterStat[]>;
  /** 숙련도만 초기화한다. 최초 노출 진도는 보존한다. */
  resetChapter(level: JlptLevel, chapter: number): Promise<void>;
}

export interface ReadingWordProgress {
  seen: boolean;
  known: boolean;
}

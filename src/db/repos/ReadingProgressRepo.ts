// 회독 진행 저장소 — (word_id, known) 단위. 챕터/현재/잠금은 word.reading_chapter 로 파생.
// FSRS(user_card)와 완전 분리된 독립 학습 경로.

import type { JlptLevel } from '~/types/Card';
import type { ChapterStat } from '~/types/Reading';

export interface ReadingProgressRepo {
  /**
   * 누적 회독: 챕터 N 대상 단어(reading_chapter<=N)의 known 상태 (word_id → known).
   * known 은 해당 chapter(회차)에 한정 — 같은 단어도 회차마다 독립.
   */
  getChapterKnown(level: JlptLevel, chapter: number): Promise<Map<string, boolean>>;
  /** 특정 회차(chapter)에서 단어 known 표시 (upsert). */
  setKnown(wordId: string, chapter: number, known: boolean, now?: number): Promise<void>;
  /** 레벨의 챕터별 누적 통계 (chapter 오름차순, total=누적 단어수, known=그 회차 known). */
  getLevelChapterStats(level: JlptLevel): Promise<ChapterStat[]>;
  /** 챕터(회차) known 초기화 (다시 외우기). */
  resetChapter(level: JlptLevel, chapter: number): Promise<void>;
}

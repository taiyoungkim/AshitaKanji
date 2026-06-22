// Design Ref: §3.2 Repository Interface — word 테이블 접근
// Service는 interface에만 의존 (SQLite/InMemory 교체 가능).

import type { JlptLevel, Word } from '~/types/Card';

export interface CardRepo {
  findById(id: string): Promise<Word | null>;
  findByIds(ids: string[]): Promise<Word[]>;
  /** 아직 user_card 없는 신규 후보 (deprecated 제외, qa_status='verified'만). */
  findNewCandidates(
    levels: JlptLevel[],
    limit: number,
    excludeWordIds: string[],
  ): Promise<Word[]>;
  /** 레벨별 출제 가능 단어 수 (deprecated 제외, qa_status='verified'). 진행도 분모. */
  countByLevel(level: JlptLevel): Promise<number>;
  /** 빠른 훑기용 랜덤 추출 (verified + 미deprecated, user_card 보유 여부 무관). */
  findScanCandidates(levels: JlptLevel[], limit: number): Promise<Word[]>;
  /** 누적 회독: 레벨에서 reading_chapter<=chapter 인 단어 전체 (verified+미deprecated), 빈도 높→낮. */
  findThroughChapter(level: JlptLevel, chapter: number): Promise<Word[]>;
}

// Design Ref: §3 Data Model — Card domain types
// Plan Ref: §5 Card Type Policy (A/B/C/D/E), §9 DB schema
//
// Card type semantics (5 kinds, exhaustively):
//   A 순수 한자        勉強
//   B 한자+오쿠리가나   食べる
//   C 순수 히라가나     ありがとう
//   D 가타카나 외래어   テレビ
//   E 혼합/오쿠리가나   お土産

export type CardType = 'A' | 'B' | 'C' | 'D' | 'E';

export type JlptLevel = 'N1' | 'N2' | 'N3' | 'N4' | 'N5';

export const JLPT_LEVELS: readonly JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;

export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export type QaStatus = 'verified' | 'auto' | 'needs_review' | 'rejected';

/** word table row */
export interface Word {
  id: string;
  level: JlptLevel;
  surface: string;             // 한자 면에 표시되는 표기
  reading_kana: string;        // 히라가나 / 가타카나 읽기
  furigana?: string | null;    // 후리가나 (B형 등)
  meaning_ko: string;
  part_of_speech?: string | null;
  card_type: CardType;
  example_jp?: string | null;
  example_ko?: string | null;
  // 예문 출처 메타 (현재 예문은 모두 외부 사전 출처, 표시는 하지 않음)
  example_jp_id?: number | null;
  example_jp_author?: string | null;
  example_ko_id?: number | null;
  example_ko_author?: string | null;
  example_license?: string | null;     // 'owner-confirmed-cleared' | 'self'
  alt_forms?: string[] | null;
  disambig?: string | null;            // 동형이의어 구분
  source?: string | null;              // 'kaggle:robinpourtaud'
  qa_status: QaStatus;
  deprecated: 0 | 1;
  tags?: string[] | null;
  data_version: number;
  frequency?: number | null;       // wordfreq Zipf (general JA corpus)
  reading_chapter?: number | null; // 회독 동결 챕터 (레벨 내 1-based, 50개/챕터)
}

/** user_card table row (FSRS state) */
export interface UserCard {
  word_id: string;
  difficulty: number;          // FSRS D
  stability: number;           // FSRS S (days)
  scheduled_days: number;
  elapsed_days: number;
  reps: number;
  lapses: number;
  last_review: number;         // unix ms
  due: number;                 // unix ms
  state: CardState;
  note?: string | null;        // V1.1
  leech: 0 | 1;
}

/** Joined view: word + optional user_card (UI consumption) */
export interface CardWithProgress {
  word: Word;
  userCard: UserCard | null;   // null = 신규 (아직 큐 진입 안 됨)
}

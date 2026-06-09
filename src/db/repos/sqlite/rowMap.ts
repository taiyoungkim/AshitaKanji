// Design Ref: §3 Data Model — SQLite row ↔ domain type mapping helpers.
// JSON 컬럼(alt_forms/tags)은 TEXT 저장 → parse. null-safe.

import type { CardType, JlptLevel, QaStatus, Word } from '~/types/Card';

/** word 테이블 raw row (SQLite 컬럼 1:1). */
export interface WordRow {
  id: string;
  level: string;
  surface: string;
  reading_kana: string;
  furigana: string | null;
  meaning_ko: string;
  part_of_speech: string | null;
  card_type: string;
  example_jp: string | null;
  example_ko: string | null;
  example_jp_id: number | null;
  example_jp_author: string | null;
  example_ko_id: number | null;
  example_ko_author: string | null;
  example_license: string | null;
  alt_forms: string | null;
  disambig: string | null;
  source: string | null;
  qa_status: string;
  deprecated: number;
  tags: string | null;
  data_version: number;
  frequency: number | null;
  reading_chapter: number | null;
}

function parseJsonArray(s: string | null): string[] | null {
  if (!s) return null;
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as string[]) : null;
  } catch {
    return null;
  }
}

export function rowToWord(r: WordRow): Word {
  return {
    id: r.id,
    level: r.level as JlptLevel,
    surface: r.surface,
    reading_kana: r.reading_kana,
    furigana: r.furigana,
    meaning_ko: r.meaning_ko,
    part_of_speech: r.part_of_speech,
    card_type: r.card_type as CardType,
    example_jp: r.example_jp,
    example_ko: r.example_ko,
    example_jp_id: r.example_jp_id,
    example_jp_author: r.example_jp_author,
    example_ko_id: r.example_ko_id,
    example_ko_author: r.example_ko_author,
    example_license: r.example_license,
    alt_forms: parseJsonArray(r.alt_forms),
    disambig: r.disambig,
    source: r.source,
    qa_status: r.qa_status as QaStatus,
    deprecated: r.deprecated === 1 ? 1 : 0,
    tags: parseJsonArray(r.tags),
    data_version: r.data_version,
    frequency: r.frequency,
    reading_chapter: r.reading_chapter,
  };
}

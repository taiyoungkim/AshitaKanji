import type { QaStatus } from './Card';

export interface Kanji {
  literal: string;
  meanings_ko: string[];
  onyomi: string[];
  kunyomi: string[];
  radical?: string | null;
  radical_name_ko?: string | null;
  radical_number?: number | null;
  stroke_count?: number | null;
  source: string;
  source_url?: string | null;
  license?: string | null;
  qa_status: QaStatus;
  data_version: number;
}

export interface KanjiForWord {
  literal: string;
  position: number;
  kanji: Kanji | null;
}

import type { SQLiteDatabase } from 'expo-sqlite';
import { extractUniqueKanji } from '~/lib/kanji';
import type { Word } from '~/types/Card';
import type { Kanji, KanjiForWord } from '~/types/Kanji';
import type { KanjiRepo } from '../KanjiRepo';

interface KanjiRow {
  literal: string;
  meanings_ko: string;
  onyomi: string | null;
  kunyomi: string | null;
  radical: string | null;
  radical_name_ko: string | null;
  radical_number: number | null;
  stroke_count: number | null;
  source: string;
  source_url: string | null;
  license: string | null;
  qa_status: string;
  data_version: number;
}

function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(',');
}

function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return value.split(/[,;、，]/).map((v) => v.trim()).filter(Boolean);
  }
}

function meaningsForDisplay(value: string | null | undefined): string[] {
  return parseStringArray(value)
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && !/[A-Za-z]/.test(v));
}

function rowToKanji(row: KanjiRow): Kanji {
  return {
    literal: row.literal,
    meanings_ko: meaningsForDisplay(row.meanings_ko),
    onyomi: parseStringArray(row.onyomi),
    kunyomi: parseStringArray(row.kunyomi),
    radical: row.radical,
    radical_name_ko: row.radical_name_ko,
    radical_number: row.radical_number,
    stroke_count: row.stroke_count,
    source: row.source,
    source_url: row.source_url,
    license: row.license,
    qa_status: row.qa_status as Kanji['qa_status'],
    data_version: row.data_version,
  };
}

export class SqliteKanjiRepo implements KanjiRepo {
  constructor(private readonly db: SQLiteDatabase) {}

  async findForWord(word: Word): Promise<KanjiForWord[]> {
    const literals = extractUniqueKanji(word.surface, word.furigana);
    if (literals.length === 0) return [];

    const rows = await this.db.getAllAsync<KanjiRow>(
      `SELECT * FROM kanji WHERE literal IN (${placeholders(literals.length)})`,
      literals,
    );
    const byLiteral = new Map(rows.map((row) => [row.literal, rowToKanji(row)]));

    return literals.map((literal, index) => ({
      literal,
      position: index,
      kanji: byLiteral.get(literal) ?? null,
    }));
  }
}

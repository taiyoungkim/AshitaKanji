import type { SQLiteDatabase } from 'expo-sqlite';
import type { WordExampleRepo } from '../WordExampleRepo';
import type { WordExample } from '~/types/WordExample';

interface WordExampleRow {
  id: number;
  word_id: string;
  jp: string;
  ko: string | null;
  source: string;
  source_url: string | null;
  license: string | null;
  permission_status: string;
  attribution: string | null;
  captured_at: number | null;
  qa_status: string;
  sort_order: number;
}

function rowToWordExample(row: WordExampleRow): WordExample {
  return {
    id: row.id,
    word_id: row.word_id,
    jp: row.jp,
    ko: row.ko,
    source: row.source,
    source_url: row.source_url,
    license: row.license,
    permission_status: row.permission_status as WordExample['permission_status'],
    attribution: row.attribution,
    captured_at: row.captured_at,
    qa_status: row.qa_status as WordExample['qa_status'],
    sort_order: row.sort_order,
  };
}

export class SqliteWordExampleRepo implements WordExampleRepo {
  constructor(private readonly db: SQLiteDatabase) {}

  async findForWord(wordId: string, limit = 3): Promise<WordExample[]> {
    const rows = await this.db.getAllAsync<WordExampleRow>(
      `SELECT *
       FROM word_example
       WHERE word_id = ?
         AND permission_status IN ('cleared', 'self')
         AND qa_status != 'rejected'
       ORDER BY sort_order ASC, id ASC
       LIMIT ?`,
      [wordId, limit],
    );
    return rows.map(rowToWordExample);
  }
}

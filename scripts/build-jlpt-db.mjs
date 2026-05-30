#!/usr/bin/env node
// Track A vocabulary pipeline:
//   1) Select curated JLPT rows from Kaggle CSV.
//   2) Optionally draft Korean meanings via OpenAI Responses API.
//   3) Emit QA CSV and build assets/jlpt.db with qa_status='auto' by default.
//
// Released data must be human-reviewed. Only rows explicitly marked verified in
// the QA CSV are inserted as qa_status='verified'.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SOURCE = '/Users/tyoung/Downloads/jlpt_vocab.csv';
const DEFAULT_WORK = resolve(ROOT, 'data/track-a/jlpt_qa_work.csv');
const DEFAULT_DB = resolve(ROOT, 'assets/jlpt.db');
const DEFAULT_REPORT = resolve(ROOT, 'data/track-a/jlpt_db_report.json');
const DATA_VERSION = 1;
const TARGET_COUNTS = { N5: 300, N4: 600, N3: 1100, N2: 1700, N1: 2500 };
const LEVEL_ORDER = ['N5', 'N4', 'N3', 'N2', 'N1'];
const QA_STATUSES = new Set(['verified', 'auto', 'needs_review', 'rejected']);

const args = parseArgs(process.argv.slice(2));
const sourcePath = resolve(args.source ?? DEFAULT_SOURCE);
const qaPath = resolve(args.qa ?? DEFAULT_WORK);
const dbPath = resolve(args.out ?? DEFAULT_DB);
const reportPath = resolve(args.report ?? DEFAULT_REPORT);
const model = args.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
const batchSize = Number(args.batchSize ?? 40);
const translate = Boolean(args.translate);
const rebuildQa = Boolean(args.rebuildQa);

if (args.help) {
  printHelp();
  process.exit(0);
}

await main();

async function main() {
  ensureParent(qaPath);
  ensureParent(dbPath);
  ensureParent(reportPath);

  let rows = existsSync(qaPath) && !rebuildQa ? readCsv(qaPath) : [];
  if (rows.length === 0) {
    rows = selectRows(readCsv(sourcePath));
    writeQaCsv(qaPath, rows);
    console.log(`created QA work CSV: ${rel(qaPath)} (${rows.length} rows)`);
  } else {
    rows = normalizeQaRows(rows);
    console.log(`loaded QA work CSV: ${rel(qaPath)} (${rows.length} rows)`);
  }

  if (translate) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for --translate');
    }
    rows = await translateMissing(rows, { model, batchSize });
    writeQaCsv(qaPath, rows);
    console.log(`updated Korean drafts: ${rel(qaPath)}`);
  }

  buildDatabase(rows, dbPath);
  const report = inspectDatabase(dbPath);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  writeAttributionFile(resolve(ROOT, 'assets/tatoeba-authors.txt'));

  console.log(`built DB: ${rel(dbPath)}`);
  console.log(`wrote report: ${rel(reportPath)}`);
  printReport(report);
  if (report.qa.verified !== 6200) {
    console.log('\nNOTE: release-gate should still fail until all 6,200 rows are human verified.');
  }
}

function selectRows(sourceRows) {
  const buckets = Object.fromEntries(LEVEL_ORDER.map((l) => [l, []]));
  const seen = new Set();

  for (const row of sourceRows) {
    const surface = clean(row.Original);
    const reading = clean(row.Furigana);
    const english = clean(row.English);
    const level = clean(row['JLPT Level']);
    if (!surface || !reading || !english || !(level in TARGET_COUNTS)) continue;

    const key = `${level}\t${surface}\t${reading}`;
    if (seen.has(key)) continue;
    seen.add(key);
    buckets[level].push({
      id: makeId(level, buckets[level].length + 1, surface, reading),
      level,
      surface,
      reading_kana: reading,
      furigana: reading,
      meaning_en: english,
      meaning_ko: '',
      part_of_speech: inferPartOfSpeech(english),
      card_type: inferCardType(surface),
      example_jp: '',
      example_ko: '',
      example_jp_id: '',
      example_jp_author: '',
      example_ko_id: '',
      example_ko_author: '',
      example_license: '',
      alt_forms: '',
      disambig: '',
      source: 'kaggle:robinpourtaud/jlpt-words-by-level',
      qa_status: 'needs_review',
      deprecated: '0',
      tags: JSON.stringify(['draft-ko-missing']),
      data_version: String(DATA_VERSION),
      qa_note: 'Korean meaning draft required',
    });
  }

  const selected = [];
  for (const level of LEVEL_ORDER) {
    const need = TARGET_COUNTS[level];
    if (buckets[level].length < need) {
      throw new Error(`${level} has ${buckets[level].length} rows, target ${need}`);
    }
    selected.push(...buckets[level].slice(0, need));
  }
  return selected;
}

async function translateMissing(rows, { model, batchSize }) {
  const out = rows.map((r) => ({ ...r }));
  let translated = 0;
  for (let i = 0; i < out.length; i += batchSize) {
    const batch = out
      .slice(i, i + batchSize)
      .filter((r) => !clean(r.meaning_ko) || r.qa_status === 'needs_review');
    if (batch.length === 0) continue;
    const result = await draftKoreanMeanings(batch, model);
    const byId = new Map(result.map((r) => [r.id, r]));
    for (const row of batch) {
      const draft = byId.get(row.id);
      if (!draft?.meaning_ko) continue;
      row.meaning_ko = clean(draft.meaning_ko);
      row.part_of_speech = clean(draft.part_of_speech) || row.part_of_speech;
      row.disambig = clean(draft.disambig);
      row.qa_status = 'auto';
      row.tags = JSON.stringify(['gpt-draft', 'needs-human-review']);
      row.qa_note = 'GPT draft; human verification required';
      translated += 1;
    }
    writeQaCsv(qaPath, out);
    console.log(`translated ${translated}/${rows.length}`);
  }
  return out;
}

async function draftKoreanMeanings(batch, model) {
  const inputRows = batch.map((r) => ({
    id: r.id,
    level: r.level,
    japanese: r.surface,
    reading: r.reading_kana,
    english: r.meaning_en,
  }));
  const schema = {
    type: 'json_schema',
    name: 'jlpt_korean_meaning_batch',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        rows: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'string' },
              meaning_ko: { type: 'string' },
              part_of_speech: { type: 'string' },
              disambig: { type: 'string' },
            },
            required: ['id', 'meaning_ko', 'part_of_speech', 'disambig'],
          },
        },
      },
      required: ['rows'],
    },
  };
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      instructions:
        'You are preparing Korean draft meanings for a Japanese JLPT vocabulary app. ' +
        'Translate the English gloss into concise natural Korean. Prefer dictionary-style meanings, ' +
        'separate alternatives with ", ", do not add explanations unless needed for disambiguation. ' +
        'These are draft meanings only and will be human-reviewed.',
      input:
        'Return JSON for these rows. Keep each meaning_ko short and suitable for a flashcard.\n' +
        JSON.stringify(inputRows),
      text: { format: schema },
      max_output_tokens: 6000,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed ${response.status}: ${body}`);
  }
  const json = await response.json();
  const text = extractOutputText(json);
  const parsed = JSON.parse(text);
  return parsed.rows ?? [];
}

function buildDatabase(rows, outPath) {
  const tmp = `${outPath}.tmp`;
  if (existsSync(tmp)) rmSync(tmp);
  execSql(tmp, [
    'PRAGMA foreign_keys = ON;',
    `CREATE TABLE word (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      surface TEXT NOT NULL,
      reading_kana TEXT NOT NULL,
      furigana TEXT,
      meaning_ko TEXT NOT NULL,
      part_of_speech TEXT,
      card_type TEXT NOT NULL CHECK (card_type IN ('A','B','C','D','E')),
      example_jp TEXT,
      example_ko TEXT,
      example_jp_id INTEGER,
      example_jp_author TEXT,
      example_ko_id INTEGER,
      example_ko_author TEXT,
      example_license TEXT,
      alt_forms TEXT,
      disambig TEXT,
      source TEXT,
      qa_status TEXT NOT NULL CHECK (qa_status IN ('verified','auto','needs_review','rejected')),
      deprecated INTEGER NOT NULL DEFAULT 0 CHECK (deprecated IN (0,1)),
      tags TEXT,
      data_version INTEGER NOT NULL
    );`,
    'CREATE INDEX idx_word_level ON word(level);',
    'CREATE INDEX idx_word_qa ON word(qa_status);',
    'CREATE INDEX idx_word_deprecated ON word(deprecated);',
    `CREATE TABLE user_card (
      word_id TEXT PRIMARY KEY,
      difficulty REAL NOT NULL,
      stability REAL NOT NULL,
      scheduled_days INTEGER NOT NULL DEFAULT 0,
      elapsed_days INTEGER NOT NULL DEFAULT 0,
      reps INTEGER NOT NULL DEFAULT 0,
      lapses INTEGER NOT NULL DEFAULT 0,
      last_review INTEGER NOT NULL DEFAULT 0,
      due INTEGER NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('new','learning','review','relearning')),
      note TEXT,
      leech INTEGER NOT NULL DEFAULT 0 CHECK (leech IN (0,1)),
      FOREIGN KEY (word_id) REFERENCES word(id)
    );`,
    'CREATE INDEX idx_user_card_due ON user_card(due);',
    'CREATE INDEX idx_user_card_state ON user_card(state);',
    'CREATE INDEX idx_user_card_leech ON user_card(leech);',
    `CREATE TABLE review_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id TEXT NOT NULL,
      reviewed_at INTEGER NOT NULL,
      grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 4),
      state_before TEXT,
      state_after TEXT NOT NULL,
      scheduled_days INTEGER NOT NULL,
      elapsed_days INTEGER NOT NULL,
      stability_after REAL NOT NULL,
      difficulty_after REAL NOT NULL,
      reveal_ms INTEGER,
      session_id INTEGER,
      FOREIGN KEY (word_id) REFERENCES word(id),
      FOREIGN KEY (session_id) REFERENCES session(id)
    );`,
    'CREATE INDEX idx_review_log_word ON review_log(word_id);',
    'CREATE INDEX idx_review_log_session ON review_log(session_id);',
    'CREATE INDEX idx_review_log_time ON review_log(reviewed_at);',
    `CREATE TABLE scan_result (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id TEXT NOT NULL,
      scanned_at INTEGER NOT NULL,
      result TEXT NOT NULL CHECK (result IN ('known','confused','unknown','later')),
      batch_size INTEGER,
      promoted_to_srs INTEGER NOT NULL DEFAULT 0 CHECK (promoted_to_srs IN (0,1)),
      session_id INTEGER,
      FOREIGN KEY (word_id) REFERENCES word(id),
      FOREIGN KEY (session_id) REFERENCES session(id)
    );`,
    'CREATE INDEX idx_scan_word ON scan_result(word_id);',
    'CREATE INDEX idx_scan_result ON scan_result(result);',
    'CREATE INDEX idx_scan_session ON scan_result(session_id);',
    `CREATE TABLE session (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mode TEXT NOT NULL CHECK (mode IN ('review','new','scan','weakness')),
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      ended_reason TEXT CHECK (ended_reason IN ('completed','abandoned','app_killed')),
      planned_new INTEGER,
      planned_review INTEGER,
      planned_scan INTEGER,
      done_new INTEGER NOT NULL DEFAULT 0,
      done_review INTEGER NOT NULL DEFAULT 0,
      done_scan INTEGER NOT NULL DEFAULT 0,
      again_count INTEGER NOT NULL DEFAULT 0
    );`,
    'CREATE INDEX idx_session_started ON session(started_at);',
    `CREATE TABLE events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      type TEXT NOT NULL,
      payload TEXT
    );`,
    'CREATE INDEX idx_events_type ON events(type);',
    'CREATE INDEX idx_events_ts ON events(ts);',
    `CREATE TABLE daily_stats (
      date TEXT PRIMARY KEY,
      new_count INTEGER NOT NULL DEFAULT 0,
      review_count INTEGER NOT NULL DEFAULT 0,
      scan_count INTEGER NOT NULL DEFAULT 0,
      scan_promoted_count INTEGER NOT NULL DEFAULT 0,
      again_count INTEGER NOT NULL DEFAULT 0,
      good_easy_count INTEGER NOT NULL DEFAULT 0,
      total_time_sec INTEGER NOT NULL DEFAULT 0,
      session_count INTEGER NOT NULL DEFAULT 0,
      completed_session_count INTEGER NOT NULL DEFAULT 0,
      avg_reveal_ms REAL
    );`,
    'CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT);',
    `INSERT INTO app_meta (key, value) VALUES
      ('schema_version', '1'),
      ('data_version', '${DATA_VERSION}'),
      ('source', 'kaggle:robinpourtaud/jlpt-words-by-level'),
      ('qa_policy', 'gpt_draft_human_verified_before_release');`,
  ]);

  const importCsv = writeWordImportCsv(rows);
  const insert = [
    '.mode csv',
    `.import ${sqlQuote(importCsv)} word_import`,
    `INSERT INTO word
      (id, level, surface, reading_kana, furigana, meaning_ko, part_of_speech, card_type,
       example_jp, example_ko, example_jp_id, example_jp_author, example_ko_id, example_ko_author,
       example_license, alt_forms, disambig, source, qa_status, deprecated, tags, data_version)
     SELECT id, level, surface, reading_kana, nullif(furigana, ''), meaning_ko,
       nullif(part_of_speech, ''), card_type, nullif(example_jp, ''), nullif(example_ko, ''),
       nullif(example_jp_id, ''), nullif(example_jp_author, ''), nullif(example_ko_id, ''),
       nullif(example_ko_author, ''), nullif(example_license, ''), nullif(alt_forms, ''),
       nullif(disambig, ''), source, qa_status, CAST(deprecated AS INTEGER), nullif(tags, ''),
       CAST(data_version AS INTEGER)
     FROM word_import;`,
    'DROP TABLE word_import;',
    'PRAGMA user_version = 1;',
    'VACUUM;',
  ];
  execSql(tmp, insert);
  if (existsSync(importCsv)) rmSync(importCsv);
  if (existsSync(outPath)) rmSync(outPath);
  renameSync(tmp, outPath);
}

function inspectDatabase(dbPath) {
  const count = (where = '1=1') =>
    Number(execSql(dbPath, [`SELECT COUNT(*) FROM word WHERE ${where};`], true).trim());
  const levelCounts = {};
  for (const level of LEVEL_ORDER) {
    levelCounts[level] = count(`level='${level}' AND deprecated=0`);
  }
  const qa = {};
  for (const status of QA_STATUSES) {
    qa[status] = count(`qa_status='${status}'`);
  }
  return {
    path: rel(dbPath),
    bytes: existsSync(dbPath) ? readFileSync(dbPath).byteLength : 0,
    total: count('deprecated=0'),
    levels: levelCounts,
    qa,
    targets: TARGET_COUNTS,
  };
}

function writeWordImportCsv(rows) {
  const p = resolve(ROOT, 'data/track-a/.word_import.csv');
  ensureParent(p);
  const headers = [
    'id',
    'level',
    'surface',
    'reading_kana',
    'furigana',
    'meaning_ko',
    'part_of_speech',
    'card_type',
    'example_jp',
    'example_ko',
    'example_jp_id',
    'example_jp_author',
    'example_ko_id',
    'example_ko_author',
    'example_license',
    'alt_forms',
    'disambig',
    'source',
    'qa_status',
    'deprecated',
    'tags',
    'data_version',
  ];
  const csv = [headers.join(',')];
  for (const row of normalizeQaRows(rows)) {
    csv.push(headers.map((h) => csvEscape(row[h] ?? '')).join(','));
  }
  writeFileSync(p, `${csv.join('\n')}\n`);
  return p;
}

function writeQaCsv(path, rows) {
  const headers = [
    'id',
    'level',
    'surface',
    'reading_kana',
    'furigana',
    'meaning_en',
    'meaning_ko',
    'part_of_speech',
    'card_type',
    'example_jp',
    'example_ko',
    'example_jp_id',
    'example_jp_author',
    'example_ko_id',
    'example_ko_author',
    'example_license',
    'alt_forms',
    'disambig',
    'source',
    'qa_status',
    'deprecated',
    'tags',
    'data_version',
    'qa_note',
  ];
  const csv = [headers.join(',')];
  for (const row of rows) {
    csv.push(headers.map((h) => csvEscape(row[h] ?? '')).join(','));
  }
  writeFileSync(path, `${csv.join('\n')}\n`);
}

function normalizeQaRows(rows) {
  return rows.map((row) => {
    const status = QA_STATUSES.has(clean(row.qa_status)) ? clean(row.qa_status) : 'needs_review';
    return {
      ...row,
      id: clean(row.id),
      level: clean(row.level),
      surface: clean(row.surface),
      reading_kana: clean(row.reading_kana),
      furigana: clean(row.furigana),
      meaning_en: clean(row.meaning_en),
      meaning_ko: clean(row.meaning_ko) || `[DRAFT MISSING] ${clean(row.meaning_en)}`,
      part_of_speech: clean(row.part_of_speech),
      card_type: clean(row.card_type) || inferCardType(clean(row.surface)),
      source: clean(row.source) || 'kaggle:robinpourtaud/jlpt-words-by-level',
      qa_status: status,
      deprecated: clean(row.deprecated) === '1' ? '1' : '0',
      tags: clean(row.tags),
      data_version: clean(row.data_version) || String(DATA_VERSION),
      qa_note: clean(row.qa_note),
    };
  });
}

function writeAttributionFile(path) {
  ensureParent(path);
  if (existsSync(path)) return;
  writeFileSync(
    path,
    [
      'AshitaKanji example sentence attribution',
      '',
      'No Tatoeba example sentences are bundled in this draft DB yet.',
      'When example_jp/example_ko rows are added, include sentence authors here and',
      'show per-card attribution in the app.',
      '',
    ].join('\n'),
  );
}

function readCsv(path) {
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map(clean);
  return rows.slice(1).filter((r) => r.some((v) => clean(v))).map((r) => {
    const obj = {};
    for (let i = 0; i < headers.length; i += 1) obj[headers[i]] = r[i] ?? '';
    return obj;
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function inferPartOfSpeech(english) {
  const e = english.toLowerCase();
  if (/^to |, to |ing\b/.test(e)) return 'verb';
  if (/\badj\b|adjective/.test(e)) return 'adjective';
  if (/\badv\b|adverb/.test(e)) return 'adverb';
  return 'noun';
}

function inferCardType(surface) {
  if (/^[\u3040-\u309fー]+$/.test(surface)) return 'C';
  if (/^[\u30a0-\u30ffー]+$/.test(surface)) return 'D';
  if (/[\u4e00-\u9fff]/.test(surface) && /[\u3040-\u309f]/.test(surface)) return 'B';
  if (/[\u4e00-\u9fff]/.test(surface)) return 'A';
  return 'E';
}

function makeId(level, n, surface, reading) {
  const slug = `${surface}-${reading}`
    .normalize('NFKC')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  return `${level.toLowerCase()}-${String(n).padStart(4, '0')}-${slug}`;
}

function extractOutputText(json) {
  if (typeof json.output_text === 'string') return json.output_text;
  const chunks = [];
  for (const item of json.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join('');
}

function execSql(dbPath, statements, capture = false) {
  const input = `${statements.join('\n')}\n`;
  const out = execFileSync('sqlite3', [dbPath], {
    input,
    encoding: 'utf8',
    stdio: capture ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'inherit', 'inherit'],
  });
  return out ?? '';
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--translate') out.translate = true;
    else if (a === '--rebuild-qa') out.rebuildQa = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
  }
  return out;
}

function printHelp() {
  console.log(`Usage:
  node scripts/build-jlpt-db.mjs [options]

Options:
  --source PATH     Kaggle CSV path (default: ${DEFAULT_SOURCE})
  --qa PATH         QA work CSV path (default: ${rel(DEFAULT_WORK)})
  --out PATH        SQLite output path (default: ${rel(DEFAULT_DB)})
  --report PATH     JSON report path (default: ${rel(DEFAULT_REPORT)})
  --translate       Draft missing Korean meanings via OpenAI Responses API
  --model MODEL     OpenAI model (default: gpt-4o-mini or OPENAI_MODEL)
  --batchSize N     Translation batch size (default: 40)
  --rebuild-qa      Recreate QA CSV from source CSV
`);
}

function printReport(report) {
  console.log('\nTrack A DB report');
  console.log(`total: ${report.total}`);
  console.log(`levels: ${Object.entries(report.levels).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`qa: ${Object.entries(report.qa).map(([k, v]) => `${k}=${v}`).join(', ')}`);
}

function ensureParent(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function clean(v) {
  return String(v ?? '').trim();
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function sqlQuote(v) {
  return `'${String(v).replace(/'/g, "''")}'`;
}

function rel(path) {
  return path.startsWith(ROOT) ? path.slice(ROOT.length + 1) : path;
}

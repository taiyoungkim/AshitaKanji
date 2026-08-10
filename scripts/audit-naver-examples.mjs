#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const wordsPath = resolve(args.words ?? 'data/pdf-vocab/jlpt_final_wordlist.json');
const examplesPath = resolve(args.examples ?? 'data/pdf-vocab/naver_examples_final_qa_work.csv');
const reportPath = resolve(args.report ?? 'data/pdf-vocab/naver_examples_final_validation.json');
const reviewPath = resolve(args.review ?? 'data/pdf-vocab/naver_examples_final_review_queue.csv');

if (!existsSync(wordsPath)) throw new Error(`word list not found: ${wordsPath}`);
if (!existsSync(examplesPath)) throw new Error(`example CSV not found: ${examplesPath}`);

const finalData = JSON.parse(readFileSync(wordsPath, 'utf8'));
const words = finalData.vocabulary ?? finalData.words ?? finalData;
const wordById = new Map(words.map((word) => [word.id, word]));
const examples = readCsv(examplesPath);
const examplesById = new Map(examples.map((row) => [row.word_id, row]));
const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];

const duplicateExampleIds = repeatedValues(examples, (row) => clean(row.naver_example_id));
const duplicateJapanese = repeatedValues(examples, (row) => clean(row.jp));
const riskySources = new Set(['플리토', '명언/속담', '웹수집']);
const reviewRows = [];

for (const row of examples) {
  const word = wordById.get(row.word_id);
  if (!word) continue;
  const score = noteNumber(row.qa_note, 'score');
  const meaningHits = noteNumber(row.qa_note, 'meaning_hits');
  const targetMatch = noteValue(row.qa_note, 'target_match');
  const flags = [];
  if (meaningHits === 0) flags.push('한국어 뜻 직접 일치어 없음');
  if (targetMatch === 'stem') flags.push('활용 어간으로만 목표어 확인');
  if (targetMatch === 'jmdict-form') flags.push('JMdict 보조 표기로 목표어 확인');
  if (score !== null && score < 80) flags.push('자동 선택 점수 80 미만');
  if (riskySources.has(clean(row.naver_source_name))) flags.push('우선 검수 출처');
  if (duplicateExampleIds.has(clean(row.naver_example_id))) flags.push('네이버 예문 ID 중복');
  if (duplicateJapanese.has(clean(row.jp))) flags.push('일본어 예문 문장 중복');
  if (flags.length === 0) continue;
  reviewRows.push({
    word_id: row.word_id,
    level: word.level,
    surface: word.surface,
    reading_kana: word.reading_kana,
    meaning_ko: word.meaning_ko,
    jp: row.jp,
    ko: row.ko,
    naver_source_name: row.naver_source_name,
    naver_example_id: row.naver_example_id,
    query: row.query,
    score: score ?? '',
    meaning_hits: meaningHits ?? '',
    target_match: targetMatch,
    review_flags: flags.join('; '),
    source_url: row.source_url,
  });
}

const missing = words
  .filter((word) => !examplesById.has(word.id))
  .map((word) => ({
    word_id: word.id,
    level: word.level,
    surface: word.surface,
    reading_kana: word.reading_kana,
    meaning_ko: word.meaning_ko,
    category: parseTags(word.tags).includes('pdf-new') ? 'PDF 신규' : '기존 유지',
  }));

const checks = {
  final_word_count: words.length === 6638,
  unique_example_word_ids: new Set(examples.map((row) => row.word_id)).size === examples.length,
  all_example_ids_in_final: examples.every((row) => wordById.has(row.word_id)),
  all_required_text_present: examples.every((row) => clean(row.jp) && clean(row.ko)),
  all_source_urls_present: examples.every((row) => clean(row.source_url)),
  all_permission_cleared: examples.every((row) => row.permission_status === 'cleared'),
  all_qa_auto: examples.every((row) => row.qa_status === 'auto'),
  no_hangul_in_japanese: examples.every((row) => !/[가-힣]/.test(row.jp)),
  coverage_reconciles: examples.length + missing.length === words.length,
};

const report = {
  generated_at: new Date().toISOString(),
  inputs: {
    words: relative(wordsPath),
    examples: relative(examplesPath),
  },
  summary: {
    final_words: words.length,
    examples: examples.length,
    missing: missing.length,
    coverage_percent: Number(((examples.length / words.length) * 100).toFixed(2)),
    inherited_examples: examples.filter((row) => !clean(row.qa_note).includes('target_match=')).length,
    newly_collected_examples: examples.filter((row) => clean(row.qa_note).includes('target_match=')).length,
    structural_validation: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
    content_review_rows: reviewRows.length,
  },
  level_coverage: Object.fromEntries(levels.map((level) => {
    const total = words.filter((word) => word.level === level).length;
    const covered = examples.filter((row) => wordById.get(row.word_id)?.level === level).length;
    return [level, { total, covered, missing: total - covered }];
  })),
  match_type_counts: countBy(
    examples.filter((row) => clean(row.qa_note).includes('target_match=')),
    (row) => noteValue(row.qa_note, 'target_match') || 'unknown',
  ),
  meaning_hit_counts: countBy(
    examples.filter((row) => clean(row.qa_note).includes('meaning_hits=')),
    (row) => String(noteNumber(row.qa_note, 'meaning_hits') ?? 'unknown'),
  ),
  source_counts: countBy(examples, (row) => clean(row.naver_source_name) || 'unknown'),
  duplicate_counts: {
    repeated_naver_example_ids: duplicateExampleIds.size,
    rows_with_repeated_naver_example_ids: examples.filter((row) => duplicateExampleIds.has(clean(row.naver_example_id))).length,
    repeated_japanese_texts: duplicateJapanese.size,
    rows_with_repeated_japanese_texts: examples.filter((row) => duplicateJapanese.has(clean(row.jp))).length,
  },
  checks,
  missing_words: missing,
};

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
writeCsv(reviewPath, reviewRows, [
  'word_id',
  'level',
  'surface',
  'reading_kana',
  'meaning_ko',
  'jp',
  'ko',
  'naver_source_name',
  'naver_example_id',
  'query',
  'score',
  'meaning_hits',
  'target_match',
  'review_flags',
  'source_url',
]);

console.log(JSON.stringify(report.summary, null, 2));
console.log(`validation: ${relative(reportPath)}`);
console.log(`review queue: ${relative(reviewPath)}`);

function noteNumber(note, key) {
  const match = clean(note).match(new RegExp(`${key}=(-?\\d+)`));
  return match ? Number(match[1]) : null;
}

function noteValue(note, key) {
  const match = clean(note).match(new RegExp(`${key}=([^;\\s]+)`));
  return match ? match[1] : '';
}

function repeatedValues(rows, getter) {
  const counts = new Map();
  for (const row of rows) {
    const value = getter(row);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([value]) => value));
}

function countBy(rows, getter) {
  const counts = {};
  for (const row of rows) {
    const key = getter(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function parseTags(raw) {
  try {
    const parsed = JSON.parse(String(raw || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function clean(value) {
  return String(value ?? '').trim();
}

function relative(path) {
  return path.startsWith(ROOT) ? path.slice(ROOT.length + 1) : path;
}

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const [key, inline] = arg.slice(2).split('=', 2);
    if (inline !== undefined) out[key] = inline;
    else if (argv[index + 1] && !argv[index + 1].startsWith('--')) out[key] = argv[++index];
    else out[key] = true;
  }
  return out;
}

function readCsv(path) {
  const rows = parseCsv(readFileSync(path, 'utf8'));
  const [headers, ...records] = rows;
  return records
    .filter((record) => record.some((cell) => clean(cell)))
    .map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ''])));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function writeCsv(path, rows, headers) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header] ?? '')).join(','));
  }
  writeFileSync(path, `${lines.join('\n')}\n`);
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const WORDS_PATH = resolve(ROOT, 'data/pdf-vocab/jlpt_final_wordlist.json');
const NAVER_PATH = resolve(ROOT, 'data/pdf-vocab/naver_examples_final_qa_work.csv');
const REFERENCE_AUDIT_PATH = resolve(ROOT, 'data/pdf-vocab/example_reference_audit.json');
const SELF_CSV_PATH = resolve(ROOT, 'data/pdf-vocab/self_authored_examples_qa_work.csv');
const FINAL_CSV_PATH = resolve(ROOT, 'data/pdf-vocab/examples_final_qa_work.csv');
const REPORT_PATH = resolve(ROOT, 'data/pdf-vocab/example_completion_report.json');

const HEADERS = [
  'word_id', 'jp', 'ko', 'source', 'source_url', 'license', 'permission_status',
  'attribution', 'captured_at', 'qa_status', 'sort_order', 'naver_example_id',
  'naver_source_cid', 'naver_source_name', 'query', 'qa_note',
];
const wordsDocument = JSON.parse(readFileSync(WORDS_PATH, 'utf8'));
const words = wordsDocument.vocabulary;
const wordById = new Map(words.map((word) => [word.id, word]));
const referenceAudit = existsSync(REFERENCE_AUDIT_PATH)
  ? JSON.parse(readFileSync(REFERENCE_AUDIT_PATH, 'utf8'))
  : { target_count: 0, exact_hit_count: 0, any_variant_hit_count: 0, items: [] };
const naverRows = readCsv(NAVER_PATH);
const currentFinalRows = existsSync(FINAL_CSV_PATH) ? readCsv(FINAL_CSV_PATH) : [];

assert(naverRows.length > 0, 'NAVER example set is empty');

const naverIds = new Set();
for (const row of naverRows) {
  assert(wordById.has(row.word_id), `NAVER row references unknown word ${row.word_id}`);
  assert(!naverIds.has(row.word_id), `Duplicate NAVER word_id ${row.word_id}`);
  assert(row.permission_status === 'cleared', `NAVER row is not cleared: ${row.word_id}`);
  assert(row.jp && row.ko, `NAVER row lacks JP/KO text: ${row.word_id}`);
  naverIds.add(row.word_id);
}

const selfIds = new Set();
const selfRows = currentFinalRows.filter((row) => row.source === 'self').map((row) => {
  const word = wordById.get(row.word_id);
  assert(word, `Self-authored row references unknown word ${row.word_id}`);
  assert(!selfIds.has(row.word_id), `Duplicate self-authored word_id ${row.word_id}`);
  assert(!naverIds.has(row.word_id), `Self-authored row overlaps NAVER: ${row.word_id}`);
  assert(row.jp && row.ko, `Self-authored row lacks JP/KO text: ${row.word_id}`);
  assert(row.permission_status === 'self', `Self-authored row has invalid permission: ${row.word_id}`);
  assert(row.license === 'self', `Self-authored row has invalid license: ${row.word_id}`);
  selfIds.add(row.word_id);
  return row;
});

const finalRows = [...naverRows, ...selfRows].sort((a, b) => a.word_id.localeCompare(b.word_id));
assert(finalRows.length === words.length, `Final example count ${finalRows.length} != word count ${words.length}`);
assert(new Set(finalRows.map((row) => row.word_id)).size === words.length, 'Final example word IDs are not unique');
assert(words.every((word) => finalRows.some((row) => row.word_id === word.id)), 'Some active words lack examples');

writeFileSync(SELF_CSV_PATH, toCsv(selfRows, HEADERS));
writeFileSync(FINAL_CSV_PATH, toCsv(finalRows, HEADERS));

const levelCounts = Object.fromEntries(['N5', 'N4', 'N3', 'N2', 'N1'].map((level) => [
  level,
  selfRows.filter((row) => wordById.get(row.word_id).level === level).length,
]));
const exactSurfaceExamples = selfRows.filter((row) => {
  const word = wordById.get(row.word_id);
  return normalizeJapanese(row.jp).includes(normalizeJapanese(word.surface));
}).length;
const report = {
  generated_at: new Date().toISOString(),
  active_words: words.length,
  final_examples: finalRows.length,
  coverage_percent: Number(((finalRows.length / words.length) * 100).toFixed(2)),
  naver_cleared_examples: naverRows.length,
  self_authored_examples: selfRows.length,
  self_authored_by_level: levelCounts,
  exact_surface_containment_passed: exactSurfaceExamples,
  inflected_or_variant_surface_examples: selfRows.length - exactSurfaceExamples,
  reference_audit: {
    scope: 'legacy self-authored reference set; phrase-review rows carry per-row source_url/qa_note',
    target_count: referenceAudit.target_count,
    exact_hit_count: referenceAudit.exact_hit_count,
    any_variant_hit_count: referenceAudit.any_variant_hit_count,
    request_errors: referenceAudit.items.flatMap((item) => item.searches).filter((search) => search.error).length,
  },
  qa_status_counts: countBy(finalRows, (row) => row.qa_status),
  permission_status_counts: countBy(finalRows, (row) => row.permission_status),
  outputs: {
    self_authored_csv: relative(SELF_CSV_PATH),
    final_examples_csv: relative(FINAL_CSV_PATH),
  },
};
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify(report, null, 2));

function normalizeJapanese(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/g, '');
}

function countBy(rows, keyFn) {
  return rows.reduce((counts, row) => {
    const key = keyFn(row) || '(blank)';
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function relative(path) {
  return path.slice(ROOT.length + 1);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readCsv(path) {
  const rows = parseCsv(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  const headers = rows.shift();
  return rows.filter((row) => row.some((cell) => cell !== '')).map((row) => Object.fromEntries(
    headers.map((header, index) => [header, row[index] ?? '']),
  ));
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
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

function toCsv(rows, headers) {
  const escape = (value) => {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return `${[headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))]
    .map((row) => row.map(escape).join(','))
    .join('\n')}\n`;
}

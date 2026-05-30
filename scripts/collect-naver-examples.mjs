#!/usr/bin/env node
// Collect one NAVER Japanese Dictionary example per active bundled word.
//
// The output is a QA/work CSV. The app only bundles rows marked
// permission_status='cleared'. The project owner confirmed that NAVER example
// usage is cleared for this app; keep that status explicit in the data.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DB = resolve(ROOT, 'assets/jlpt.db');
const DEFAULT_OUT = resolve(ROOT, 'data/track-a/naver_examples_qa_work.csv');
const DEFAULT_REPORT = resolve(ROOT, 'data/track-a/naver_examples_report.json');
const NAVER_EXAMPLE_API = 'https://ja.dict.naver.com/api3/jako/search';
const NAVER_SEARCH_URL = 'https://ja.dict.naver.com/#/search?query=';
const HEADERS = [
  'word_id',
  'jp',
  'ko',
  'source',
  'source_url',
  'license',
  'permission_status',
  'attribution',
  'captured_at',
  'qa_status',
  'sort_order',
  'naver_example_id',
  'naver_source_cid',
  'naver_source_name',
  'query',
  'qa_note',
];

const args = parseArgs(process.argv.slice(2));
const dbPath = resolve(args.db ?? DEFAULT_DB);
const outPath = resolve(args.out ?? DEFAULT_OUT);
const reportPath = resolve(args.report ?? DEFAULT_REPORT);
const limit = Number(args.limit ?? 0);
const offset = Number(args.offset ?? 0);
const concurrency = Math.max(1, Number(args.concurrency ?? 3));
const delayMs = Math.max(0, Number(args.delayMs ?? 180));
const timeoutMs = Math.max(1000, Number(args.timeoutMs ?? 8000));
const force = Boolean(args.force);
const refreshExisting = Boolean(args['refresh-existing']);
const levels = args.levels ? new Set(String(args.levels).split(',').map((v) => v.trim()).filter(Boolean)) : null;

if (args.help) {
  printHelp();
  process.exit(0);
}

await main();

async function main() {
  if (!existsSync(dbPath)) {
    throw new Error(`DB not found: ${rel(dbPath)}. Run npm run track-a:build first.`);
  }
  ensureParent(outPath);
  ensureParent(reportPath);

  const words = readWords(dbPath)
    .filter((word) => !levels || levels.has(word.level))
    .slice(offset, limit > 0 ? offset + limit : undefined);
  const existing = existsSync(outPath) ? readCsv(outPath) : [];
  const byWordId = new Map(existing.map((row) => [row.word_id, row]));
  // --refresh-existing: CSV에 이미 예문이 있는 단어만 재선택 (신규 수집 없이 품질 갱신).
  const targets = refreshExisting
    ? words.filter((word) => byWordId.has(word.id))
    : force
      ? words
      : words.filter((word) => !byWordId.has(word.id));
  const collected = [];
  const misses = [];
  const startedAt = Date.now();
  let cursor = 0;
  let processed = 0;

  console.log(`words=${words.length}, existing=${existing.length}, targets=${targets.length}`);

  async function worker(workerId) {
    while (cursor < targets.length) {
      const index = cursor;
      cursor += 1;
      const word = targets[index];
      await sleep(delayMs * workerId);
      try {
        const row = await collectWordExample(word);
        if (row) {
          collected.push(row);
          byWordId.set(word.id, row);
        } else {
          misses.push({ word_id: word.id, surface: word.surface, reason: 'no usable translated example' });
        }
      } catch (err) {
        misses.push({
          word_id: word.id,
          surface: word.surface,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
      processed += 1;
      if (processed % 10 === 0 || processed === targets.length) {
        writeCsv(outPath, Array.from(byWordId.values()).sort(compareRows));
        writeReport(reportPath, { words, existing, collected, misses, processed, targets, startedAt });
        console.log(`processed ${processed}/${targets.length}, collected=${collected.length}, misses=${misses.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i + 1)));
  writeCsv(outPath, Array.from(byWordId.values()).sort(compareRows));
  writeReport(reportPath, { words, existing, collected, misses, processed, targets, startedAt });
}

function readWords(path) {
  const sql = `
    SELECT id, level, surface, reading_kana, meaning_ko
    FROM word
    WHERE deprecated = 0
    ORDER BY level, id
  `;
  const raw = execFileSync('sqlite3', ['-json', path, sql], { encoding: 'utf8' });
  return JSON.parse(raw);
}

async function collectWordExample(word) {
  const json = await fetchNaverExamples(word.surface);
  const items = json?.searchResultMap?.searchResultListMap?.EXAMPLE?.items;
  const best = selectBestExample(Array.isArray(items) ? items : [], word);
  if (!best) return null;
  const sourceName = best.sourceName || 'NAVER 일본어사전';
  return {
    word_id: word.id,
    jp: best.jp,
    ko: best.ko,
    source: 'naver-ja-dict',
    source_url: `${NAVER_SEARCH_URL}${encodeURIComponent(word.surface)}`,
    license: 'owner-confirmed-cleared',
    permission_status: 'cleared',
    attribution: `NAVER 일본어사전 · ${sourceName}`,
    captured_at: String(Date.now()),
    qa_status: 'auto',
    sort_order: '0',
    naver_example_id: best.exampleId,
    naver_source_cid: best.sourceCid,
    naver_source_name: sourceName,
    query: word.surface,
    qa_note: best.note,
  };
}

async function fetchNaverExamples(query, attempt = 1) {
  const url = new URL(NAVER_EXAMPLE_API);
  url.searchParams.set('query', query);
  url.searchParams.set('m', 'pc');
  url.searchParams.set('range', 'example');
  url.searchParams.set('page', '1');
  url.searchParams.set('haveTrans', '1');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json,text/plain,*/*',
        Referer: 'https://ja.dict.naver.com/',
        'User-Agent': 'Mozilla/5.0 AshitaKanji data pipeline',
      },
    });
  } catch (err) {
    clearTimeout(timeout);
    if (attempt < 3) {
      await sleep(1200 * attempt);
      return fetchNaverExamples(query, attempt + 1);
    }
    throw err;
  }
  clearTimeout(timeout);
  const text = await response.text();
  if (!response.ok) {
    if (attempt < 3 && (response.status === 429 || response.status >= 500)) {
      await sleep(1200 * attempt);
      return fetchNaverExamples(query, attempt + 1);
    }
    throw new Error(`NAVER API ${response.status}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    if (attempt < 3) {
      await sleep(1200 * attempt);
      return fetchNaverExamples(query, attempt + 1);
    }
    throw new Error('NAVER API returned non-JSON');
  }
}

function selectBestExample(items, word) {
  const surface = compact(word.surface);
  const reading = compact(word.reading_kana);
  const candidates = items
    .map((item) => toCandidate(item, surface, reading))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}

function toCandidate(item, surface, reading) {
  const jp = cleanExampleHtml(item.expExample1);
  const ko = cleanExampleHtml(item.expExample2 || item.translation);
  if (!jp || !ko) return null;
  if (!hasJapanese(jp) || !hasKorean(ko)) return null;
  const compactJp = compact(jp);
  if (compactJp === surface || compactJp === reading) return null;
  if (compactJp.length < Math.max(4, surface.length + 2)) return null;

  let score = 0;
  if (compactJp.includes(surface)) score += 50;
  if (reading && compactJp.includes(reading)) score += 8;
  if (String(item.haveTrans) === '1') score += 20;
  if (String(item.matchType || '').startsWith('exact')) score += 8;
  if (/[。.!?？,，、]/.test(jp)) score += 5;
  if (jp.length <= 80) score += 5;
  if (item.sourceDictnameURL) score += 2;

  // 일반 사용 예문 선호 — 사자성어·관용구·속담 감점, 일상 문장 가점.
  // (예: 秋(あき)에 危急存亡の秋, 明後日에 紺屋の明後日 같은 비일반 예문 회피)
  // 1) 한자 연속 런: 危急存亡(4연속) 같은 사자성어 신호
  const kanjiRun = longestKanjiRun(compactJp);
  if (kanjiRun >= 4) score -= 40;
  else if (kanjiRun === 3) score -= 8;

  // 2) 한자 밀도: 관용구/한문투는 한자 비율이 높음
  const kanjiCount = (compactJp.match(/[㐀-鿿]/g) || []).length;
  if (compactJp.length > 0 && kanjiCount / compactJp.length > 0.6) score -= 15;

  // 3) 일상 문장 구조: 주격/목적격 조사가 있으면 완결 문장에 가까움
  if (/[はがをにへでと]/.test(jp)) score += 12;
  else score -= 10;

  // 4) 서술형 종결 선호 (단어·구 단편 회피)
  if (/(です|ます|だ|た|る|ない|でした|ません|ください)[。.！？]?$/.test(jp.trim())) score += 8;

  return {
    jp,
    ko,
    score,
    exampleId: clean(item.exampleId),
    sourceCid: clean(item.sourceCid),
    sourceName: clean(item.sourceDictnameKO || item.sourceDictnameOri),
    note: `auto-selected score=${score}`,
  };
}

function cleanExampleHtml(value) {
  return decodeHtml(clean(value)
    .replace(/<rt[^>]*>[\s\S]*?<\/rt>/gi, '')
    .replace(/<rp[^>]*>[\s\S]*?<\/rp>/gi, '')
    .replace(/<\/?rb[^>]*>/gi, '')
    .replace(/<\/?ruby[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim());
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/\s+/g, ' ')
    .trim();
}

function clean(value) {
  return String(value ?? '').trim();
}

function compact(value) {
  return clean(value).replace(/\s+/g, '');
}

/** 가장 긴 한자 연속 길이. 사자성어/한문투 예문 탐지용. */
function longestKanjiRun(value) {
  let max = 0;
  let cur = 0;
  for (const ch of value) {
    if (/[㐀-鿿]/.test(ch)) {
      cur += 1;
      if (cur > max) max = cur;
    } else {
      cur = 0;
    }
  }
  return max;
}

function hasJapanese(value) {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(value);
}

function hasKorean(value) {
  return /[\uac00-\ud7af]/.test(value);
}

function readCsv(path) {
  const text = readFileSync(path, 'utf8');
  const rows = parseCsv(text);
  const [headers, ...records] = rows;
  return records
    .filter((record) => record.some((cell) => cell.trim()))
    .map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ''])));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function writeCsv(path, rows) {
  const csv = [HEADERS.join(',')];
  for (const row of rows) {
    csv.push(HEADERS.map((header) => csvEscape(row[header] ?? '')).join(','));
  }
  writeFileSync(path, `${csv.join('\n')}\n`);
}

function writeReport(path, { words, existing, collected, misses, processed, targets, startedAt }) {
  const report = {
    generated_at: new Date().toISOString(),
    elapsed_sec: Math.round((Date.now() - startedAt) / 1000),
    db: rel(dbPath),
    out: rel(outPath),
    total_words_selected: words.length,
    existing_rows: existing.length,
    target_rows: targets.length,
    processed,
    collected: collected.length,
    misses: misses.length,
    miss_samples: misses.slice(0, 40),
  };
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
}

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function compareRows(a, b) {
  return String(a.word_id).localeCompare(String(b.word_id));
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const [key, inline] = arg.slice(2).split('=', 2);
      if (inline !== undefined) out[key] = inline || true;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[key] = argv[++i];
      else out[key] = true;
    }
  }
  return out;
}

function ensureParent(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function rel(path) {
  return path.startsWith(ROOT) ? path.slice(ROOT.length + 1) : path;
}

function printHelp() {
  console.log(`
Usage: node scripts/collect-naver-examples.mjs [options]

Options:
  --db PATH             Bundled SQLite DB to read words from (default: assets/jlpt.db)
  --out PATH            Output CSV (default: data/track-a/naver_examples_qa_work.csv)
  --report PATH         Output JSON report (default: data/track-a/naver_examples_report.json)
  --levels N5,N4        Restrict JLPT levels
  --limit N             Collect at most N selected words
  --offset N            Skip N selected words before collecting
  --concurrency N       Parallel workers (default: 3)
  --delayMs N           Per-worker delay before requests (default: 180)
  --timeoutMs N         Per-request timeout (default: 8000)
  --force               Recollect rows already present in the output CSV
  --refresh-existing    Re-select only words already in the CSV (no new words)
`);
}

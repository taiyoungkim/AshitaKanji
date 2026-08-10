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
import { gunzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DB = resolve(ROOT, 'assets/jlpt.db');
const DEFAULT_OUT = resolve(ROOT, 'data/track-a/naver_examples_qa_work.csv');
const DEFAULT_REPORT = resolve(ROOT, 'data/track-a/naver_examples_report.json');
const DEFAULT_JMDICT = resolve(ROOT, '.cache/JMdict_e.gz');
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
const wordsPath = args.words ? resolve(args.words) : null;
const outPath = resolve(args.out ?? DEFAULT_OUT);
const reportPath = resolve(args.report ?? DEFAULT_REPORT);
const missesPath = resolve(
  args.misses ?? reportPath.replace(/\.json$/i, '') + '_misses.json',
);
const seedPath = args.seed ? resolve(args.seed) : null;
const identityManifestPath = args['identity-manifest']
  ? resolve(args['identity-manifest'])
  : null;
const jmdictPath = resolve(args.jmdict ?? DEFAULT_JMDICT);
const limit = Number(args.limit ?? 0);
const offset = Number(args.offset ?? 0);
const concurrency = Math.max(1, Number(args.concurrency ?? 3));
const delayMs = Math.max(0, Number(args.delayMs ?? 180));
const timeoutMs = Math.max(1000, Number(args.timeoutMs ?? 8000));
const maxAttempts = Math.max(1, Number(args.retries ?? 3));
const force = Boolean(args.force);
const refreshExisting = Boolean(args['refresh-existing']);
const contextualQuery = Boolean(args.contextual);
const resetContextual = Boolean(args['reset-contextual']);
const levels = args.levels ? new Set(String(args.levels).split(',').map((v) => v.trim()).filter(Boolean)) : null;

if (args.help) {
  printHelp();
  process.exit(0);
}

await main();

async function main() {
  if (!wordsPath && !existsSync(dbPath)) {
    throw new Error(`DB not found: ${rel(dbPath)}. Run npm run track-a:build first.`);
  }
  if (wordsPath && !existsSync(wordsPath)) {
    throw new Error(`Word list not found: ${rel(wordsPath)}`);
  }
  if (seedPath && !existsSync(seedPath)) {
    throw new Error(`Seed example CSV not found: ${rel(seedPath)}`);
  }
  if (identityManifestPath && !existsSync(identityManifestPath)) {
    throw new Error(`Identity manifest not found: ${rel(identityManifestPath)}`);
  }
  ensureParent(outPath);
  ensureParent(reportPath);
  ensureParent(missesPath);

  const words = readWords(wordsPath ?? dbPath)
    .filter((word) => !levels || levels.has(word.level))
    .slice(offset, limit > 0 ? offset + limit : undefined);
  attachJmdictForms(words, jmdictPath);
  const outputOnDisk = existsSync(outPath) ? readCsv(outPath) : [];
  const outputExisting = resetContextual
    ? outputOnDisk.filter((row) => !clean(row.qa_note).includes('; query='))
    : outputOnDisk;
  const resetRows = outputOnDisk.length - outputExisting.length;
  const byWordId = new Map(outputExisting.map((row) => [row.word_id, row]));
  const seeded = seedPath
    ? mergeSeedExamples({
        byWordId,
        words,
        seedRows: readCsv(seedPath),
        identityManifestPath,
      })
    : [];
  const existing = Array.from(byWordId.values());
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

  console.log(
    `words=${words.length}, output_existing=${outputExisting.length}, ` +
      `reset_contextual=${resetRows}, seeded=${seeded.length}, ` +
      `ready=${existing.length}, targets=${targets.length}`,
  );

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
        writeReport(reportPath, {
          words,
          outputExisting,
          existing,
          seeded,
          collected,
          misses,
          processed,
          targets,
          startedAt,
        });
        writeMisses(missesPath, { misses, processed, targets, startedAt });
        console.log(`processed ${processed}/${targets.length}, collected=${collected.length}, misses=${misses.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i + 1)));
  writeCsv(outPath, Array.from(byWordId.values()).sort(compareRows));
  writeReport(reportPath, {
    words,
    outputExisting,
    existing,
    seeded,
    collected,
    misses,
    processed,
    targets,
    startedAt,
  });
  writeMisses(missesPath, { misses, processed, targets, startedAt });
}

function readWords(path) {
  if (/\.json$/i.test(path)) {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    const rows = Array.isArray(parsed) ? parsed : parsed.vocabulary ?? parsed.words ?? [];
    return rows
      .filter((row) => Number(row.deprecated ?? 0) === 0)
      .map(normalizeWordRow);
  }
  if (/\.csv$/i.test(path)) {
    return readCsv(path)
      .filter((row) => Number(row.deprecated ?? 0) === 0)
      .map(normalizeWordRow);
  }
  const sql = `
    SELECT id, level, surface, reading_kana, meaning_ko, part_of_speech,
           example_jp, example_ko, example_jp_author, example_license
    FROM word
    WHERE deprecated = 0
    ORDER BY level, id
  `;
  const raw = execFileSync('sqlite3', ['-json', path, sql], { encoding: 'utf8' });
  return JSON.parse(raw).map(normalizeWordRow);
}

function normalizeWordRow(row) {
  return {
    id: clean(row.id),
    level: clean(row.level),
    surface: clean(row.surface),
    reading_kana: clean(row.reading_kana),
    meaning_ko: clean(row.meaning_ko),
    part_of_speech: clean(row.part_of_speech),
    example_jp: clean(row.example_jp),
    example_ko: clean(row.example_ko),
    example_jp_author: clean(row.example_jp_author),
    example_license: clean(row.example_license),
  };
}

function attachJmdictForms(words, path) {
  if (!existsSync(path)) return;
  const wantedReadings = new Set(words.map((word) => word.reading_kana).filter(Boolean));
  const formsByReading = new Map();
  const xml = gunzipSync(readFileSync(path)).toString('utf8');
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const body = match[1];
    const readings = [...body.matchAll(/<reb>(.*?)<\/reb>/g)]
      .map((item) => clean(item[1]))
      .filter((reading) => wantedReadings.has(reading));
    if (readings.length === 0) continue;
    const forms = [...body.matchAll(/<keb>(.*?)<\/keb>/g)].map((item) => clean(item[1]));
    for (const reading of readings) {
      const bucket = formsByReading.get(reading) ?? new Set();
      for (const form of forms) bucket.add(form);
      formsByReading.set(reading, bucket);
    }
  }
  for (const word of words) {
    word.match_forms = unique([
      word.surface,
      word.reading_kana,
      ...(formsByReading.get(word.reading_kana) ?? []),
    ]);
  }
}

function mergeSeedExamples({ byWordId, words, seedRows, identityManifestPath }) {
  const wordById = new Map(words.map((word) => [word.id, word]));
  const idRemap = new Map();
  if (identityManifestPath) {
    const manifest = JSON.parse(readFileSync(identityManifestPath, 'utf8'));
    for (const row of manifest.retained_corrections ?? []) {
      if (Number(row.identity_changed) === 1 && row.old_id && row.new_id) {
        idRemap.set(clean(row.old_id), clean(row.new_id));
      }
    }
  }

  const seeded = [];
  for (const source of seedRows) {
    const oldId = clean(source.word_id);
    const targetId = wordById.has(oldId) ? oldId : idRemap.get(oldId);
    if (!targetId || byWordId.has(targetId)) continue;
    const word = wordById.get(targetId);
    if (!word || !clean(source.jp) || !clean(source.ko)) continue;

    const wasRemapped = targetId !== oldId;
    // Stable IDs encode surface+reading, not meaning. A new PDF sense can reuse an
    // old ID while requiring a different example (e.g. かける "안경을 쓰다" vs
    // legacy "말을 걸다"). Seed only examples already approved into the final
    // candidate row, and require exact Japanese text equality.
    if (!word.example_jp || clean(source.jp) !== word.example_jp) continue;
    if (word.example_ko && clean(source.ko) !== word.example_ko) continue;
    const row = {
      ...source,
      word_id: targetId,
      source_url: `${NAVER_SEARCH_URL}${encodeURIComponent(word.surface)}`,
      query: word.surface,
      qa_note: wasRemapped
        ? `${clean(source.qa_note)}; id-remapped ${oldId}->${targetId}`.replace(/^;\s*/, '')
        : clean(source.qa_note),
    };
    byWordId.set(targetId, row);
    seeded.push(row);
  }
  return seeded;
}

async function collectWordExample(word) {
  const queries = contextualQuery
    ? unique([makeContextQuery(word), word.surface])
    : [word.surface];
  let best = null;
  let selectedQuery = word.surface;
  for (const query of queries) {
    const json = await fetchNaverExamples(query);
    const items = json?.searchResultMap?.searchResultListMap?.EXAMPLE?.items;
    best = selectBestExample(Array.isArray(items) ? items : [], word);
    if (best) {
      selectedQuery = query;
      break;
    }
  }
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
    query: selectedQuery,
    qa_note: `${best.note}; query=${selectedQuery}`,
  };
}

function makeContextQuery(word) {
  const meaning = clean(word.meaning_ko)
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[;,/|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 36);
  return meaning ? `${word.surface} ${meaning}` : word.surface;
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
    if (attempt < maxAttempts) {
      await sleep(1200 * attempt);
      return fetchNaverExamples(query, attempt + 1);
    }
    throw err;
  }
  clearTimeout(timeout);
  const text = await response.text();
  if (!response.ok) {
    if (attempt < maxAttempts && (response.status === 429 || response.status >= 500)) {
      await sleep(1200 * attempt);
      return fetchNaverExamples(query, attempt + 1);
    }
    throw new Error(`NAVER API ${response.status}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    if (attempt < maxAttempts) {
      await sleep(1200 * attempt);
      return fetchNaverExamples(query, attempt + 1);
    }
    throw new Error('NAVER API returned non-JSON');
  }
}

function selectBestExample(items, word) {
  const surface = compact(word.surface);
  const reading = compact(word.reading_kana);
  const meaningTokens = koreanMeaningTokens(word.meaning_ko);
  const candidates = items
    .map((item) => toCandidate(item, word, surface, reading, meaningTokens))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}

function toCandidate(item, word, surface, reading, meaningTokens) {
  const jp = cleanExampleHtml(item.expExample1);
  const ko = cleanExampleHtml(item.expExample2 || item.translation);
  if (!jp || !ko) return null;
  if (!hasJapanese(jp) || !hasKorean(ko)) return null;
  if (hasKorean(jp)) return null;
  const compactJp = compact(jp);
  const searchableJp = compact(cleanSearchableExampleHtml(item.expExample1));
  const targetMatch = matchJapaneseTarget({
    compactJp,
    searchableJp,
    surface,
    reading,
    knownForms: word.match_forms,
    partOfSpeech: word.part_of_speech,
  });
  if (!targetMatch.matched) return null;
  if (compactJp === surface || compactJp === reading) return null;
  if (compactJp.length < Math.max(4, surface.length + 2)) return null;

  let score = 0;
  if (targetMatch.exactSurface) score += 50;
  if (targetMatch.exactReading) score += 20;
  if (targetMatch.jmdictForm) score += 42;
  if (targetMatch.stemOnly) score += 8;
  if (String(item.haveTrans) === '1') score += 20;
  if (String(item.matchType || '').startsWith('exact')) score += 8;
  if (/[。.!?？,，、]/.test(jp)) score += 5;
  if (jp.length <= 80) score += 5;
  if (item.sourceDictnameURL) score += 2;

  const compactKo = compact(ko);
  const meaningHits = meaningTokens.filter((token) => compactKo.includes(token)).length;
  score += Math.min(meaningHits, 3) * 12;

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
    note:
      `auto-selected score=${score} meaning_hits=${meaningHits} ` +
      `target_match=${targetMatch.kind}`,
  };
}

function cleanSearchableExampleHtml(value) {
  return decodeHtml(clean(value)
    .replace(/<rp[^>]*>[\s\S]*?<\/rp>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim());
}

function matchJapaneseTarget({ compactJp, searchableJp, surface, reading, knownForms, partOfSpeech }) {
  const exactSurface = Boolean(surface && (compactJp.includes(surface) || searchableJp.includes(surface)));
  const exactReading = Boolean(reading && (compactJp.includes(reading) || searchableJp.includes(reading)));
  const jmdictForm = unique(knownForms ?? [])
    .filter((form) => form !== surface && form !== reading)
    .find((form) => compactJp.includes(form) || searchableJp.includes(form));
  if (exactSurface || exactReading || jmdictForm) {
    return {
      matched: true,
      exactSurface,
      exactReading,
      jmdictForm: Boolean(jmdictForm),
      stemOnly: false,
      kind: exactSurface ? 'surface' : exactReading ? 'reading' : 'jmdict-form',
    };
  }

  const pos = clean(partOfSpeech);
  const allowStem = pos === 'verb' || pos === 'adjective' || /[うくぐすつぬぶむるい]$/.test(reading);
  const stems = allowStem
    ? unique([inflectionStem(surface), inflectionStem(reading)]).filter((stem) => stem.length >= 2)
    : [];
  const stem = stems.find((candidate) =>
    compactJp.includes(candidate) || searchableJp.includes(candidate));
  return {
    matched: Boolean(stem),
    exactSurface: false,
    exactReading: false,
    jmdictForm: false,
    stemOnly: Boolean(stem),
    kind: stem ? 'stem' : 'none',
  };
}

function inflectionStem(value) {
  const text = compact(value);
  return text.length >= 3 ? text.slice(0, -1) : '';
}

function koreanMeaningTokens(value) {
  const stop = new Set(['하다', '되다', '있다', '없다', '이다', '것', '등']);
  return unique((clean(value).match(/[가-힣]{2,}/g) || []).filter((token) => !stop.has(token)));
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
  // Python's utf-8-sig CSV writer emits a BOM.  Strip it so the first key is
  // `id`/`word_id` rather than an invisible-BOM-prefixed field name.
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
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

function writeReport(
  path,
  { words, outputExisting, existing, seeded, collected, misses, processed, targets, startedAt },
) {
  const report = {
    generated_at: new Date().toISOString(),
    elapsed_sec: Math.round((Date.now() - startedAt) / 1000),
    word_source: rel(wordsPath ?? dbPath),
    out: rel(outPath),
    misses_file: rel(missesPath),
    total_words_selected: words.length,
    output_existing_rows: outputExisting.length,
    existing_rows: existing.length,
    seeded_rows: seeded.length,
    target_rows: targets.length,
    processed,
    collected: collected.length,
    misses: misses.length,
    miss_samples: misses.slice(0, 40),
  };
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
}

function writeMisses(path, { misses, processed, targets, startedAt }) {
  const report = {
    generated_at: new Date().toISOString(),
    elapsed_sec: Math.round((Date.now() - startedAt) / 1000),
    processed,
    target_rows: targets.length,
    misses: misses.length,
    items: misses,
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

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
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
  --words PATH          Read words from final JSON/CSV instead of SQLite
  --out PATH            Output CSV (default: data/track-a/naver_examples_qa_work.csv)
  --report PATH         Output JSON report (default: data/track-a/naver_examples_report.json)
  --misses PATH         Full miss/error JSON (default: <report>_misses.json)
  --seed PATH           Seed matching existing examples from another QA CSV
  --identity-manifest PATH
                        Remap seed rows whose stable word ID changed
  --jmdict PATH         JMdict gzip for reading-linked written forms
  --contextual          Search with "Japanese surface + Korean meaning" first
  --reset-contextual    Drop prior contextual auto-collections before this run
  --levels N5,N4        Restrict JLPT levels
  --limit N             Collect at most N selected words
  --offset N            Skip N selected words before collecting
  --concurrency N       Parallel workers (default: 3)
  --delayMs N           Per-worker delay before requests (default: 180)
  --timeoutMs N         Per-request timeout (default: 8000)
  --retries N           Attempts per query (default: 3; use 1 for bulk first pass)
  --force               Recollect rows already present in the output CSV
  --refresh-existing    Re-select only words already in the CSV (no new words)
`);
}

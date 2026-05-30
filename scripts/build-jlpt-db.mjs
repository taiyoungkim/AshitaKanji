#!/usr/bin/env node
// Track A vocabulary pipeline:
//   1) Select curated JLPT rows from Kaggle CSV.
//   1b) Deprecate grammar/affix patterns and backfill same-level vocabulary rows.
//   2) Optionally draft Korean meanings via OpenAI Responses API.
//   3) Emit QA CSV and build assets/jlpt.db with qa_status='auto' by default.
//
// Released data must be human-reviewed. Only rows explicitly marked verified in
// the QA CSV are inserted as qa_status='verified'.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SOURCE = '/Users/tyoung/Downloads/jlpt_vocab.csv';
const DEFAULT_WORK = resolve(ROOT, 'data/track-a/jlpt_qa_work.csv');
const DEFAULT_DB = resolve(ROOT, 'assets/jlpt.db');
const DEFAULT_REPORT = resolve(ROOT, 'data/track-a/jlpt_db_report.json');
const DEFAULT_KANJI_QA = resolve(ROOT, 'data/track-a/kanji_qa_work.csv');
const DEFAULT_NAVER_EXAMPLES = resolve(ROOT, 'data/track-a/naver_examples_qa_work.csv');
const DEFAULT_KANJIDIC = resolve(ROOT, '.cache/kanjidic2.xml.gz');
const KANJIDIC_URL = 'https://www.edrdg.org/kanjidic/kanjidic2.xml.gz';
const KANJIDIC_LICENSE = 'CC BY-SA 4.0';
const DATA_VERSION = 1;
const TARGET_COUNTS = { N5: 300, N4: 600, N3: 1100, N2: 1700, N1: 2500 };
const LEVEL_ORDER = ['N5', 'N4', 'N3', 'N2', 'N1'];
const QA_STATUSES = new Set(['verified', 'auto', 'needs_review', 'rejected']);
const NON_VOCAB_TAG = 'non-vocabulary';
const DUPLICATE_TAG = 'duplicate-active-replaced';
const KANJI_RADICALS =
  '一丨丶丿乙亅二亠人儿入八冂冖冫几凵刀力勹匕匚匸十卜卩厂厶又口囗土士夂夊夕大女子宀寸小尢尸屮山巛工己巾干幺广廴廾弋弓彐彡彳心戈戶手支攴文斗斤方无日曰月木欠止歹殳毋比毛氏气水火爪父爻爿片牙牛犬玄玉瓜瓦甘生用田疋疒癶白皮皿目矛矢石示禸禾穴立竹米糸缶网羊羽老而耒耳聿肉臣自至臼舌舛舟艮色艸虍虫血行衣襾見角言谷豆豕豸貝赤走足身車辛辰辵邑酉釆里金長門阜隶隹雨青非面革韋韭音頁風飛食首香馬骨高髟鬥鬯鬲鬼魚鳥鹵鹿麥麻黃黍黑黹黽鼎鼓鼠鼻齊齒龍龜龠';

const args = parseArgs(process.argv.slice(2));
const sourcePath = resolve(args.source ?? DEFAULT_SOURCE);
const qaPath = resolve(args.qa ?? DEFAULT_WORK);
const dbPath = resolve(args.out ?? DEFAULT_DB);
const reportPath = resolve(args.report ?? DEFAULT_REPORT);
const kanjiQaPath = resolve(args.kanjiQa ?? DEFAULT_KANJI_QA);
const naverExamplesPath = resolve(args.naverExamples ?? DEFAULT_NAVER_EXAMPLES);
const kanjidicPath = resolve(args.kanjidic ?? DEFAULT_KANJIDIC);
const model = args.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
const batchSize = Number(args.batchSize ?? 40);
const translate = Boolean(args.translate);
const rebuildQa = Boolean(args.rebuildQa);
const skipKanjidic = Boolean(args.skipKanjidic);

if (args.help) {
  printHelp();
  process.exit(0);
}

await main();

async function main() {
  ensureParent(qaPath);
  ensureParent(dbPath);
  ensureParent(reportPath);
  ensureParent(kanjiQaPath);
  if (!skipKanjidic) await ensureKanjidicFile(kanjidicPath);

  let rows = existsSync(qaPath) && !rebuildQa ? readCsv(qaPath) : [];
  if (rows.length === 0) {
    rows = selectRows(readCsv(sourcePath));
    const curation = curateAndBackfillRows(rows);
    rows = curation.rows;
    writeQaCsv(qaPath, rows);
    console.log(`created QA work CSV: ${rel(qaPath)} (${rows.length} rows)`);
    printCurationResult(curation);
  } else {
    const curation = curateAndBackfillRows(rows);
    rows = curation.rows;
    if (writeQaCsvIfChanged(qaPath, rows)) {
      console.log(`updated QA curation metadata: ${rel(qaPath)}`);
    }
    printCurationResult(curation);
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

  const kanjidic = skipKanjidic ? new Map() : parseKanjidic(kanjidicPath);
  const kanjiQaRows = buildKanjiQaRows(rows, kanjidic);
  if (writeKanjiQaCsvIfChanged(kanjiQaPath, kanjiQaRows)) {
    console.log(`updated kanji QA work CSV: ${rel(kanjiQaPath)} (${kanjiQaRows.length} rows)`);
  } else {
    console.log(`loaded kanji QA work CSV: ${rel(kanjiQaPath)} (${kanjiQaRows.length} rows)`);
  }

  const naverExampleRows = readNaverExampleRows(naverExamplesPath, rows);
  if (naverExampleRows.length > 0) {
    rows = attachPrimaryExamples(rows, naverExampleRows);
    console.log(`loaded NAVER examples: ${rel(naverExamplesPath)} (${naverExampleRows.length} rows)`);
  } else if (existsSync(naverExamplesPath)) {
    console.log(`loaded NAVER examples: ${rel(naverExamplesPath)} (0 usable rows)`);
  }

  buildDatabase(rows, dbPath, kanjiQaRows, naverExampleRows);
  const report = inspectDatabase(dbPath);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  writeAttributionFile(resolve(ROOT, 'assets/tatoeba-authors.txt'));

  console.log(`built DB: ${rel(dbPath)}`);
  console.log(`wrote report: ${rel(reportPath)}`);
  printReport(report);
  if (report.activeQa.verified !== report.total || report.activeQa.nonVerified !== 0) {
    console.log('\nNOTE: release-gate should still fail until every active study row is human verified.');
  }
}

function curateAndBackfillRows(rows) {
  const normalized = normalizeQaRows(rows);
  const duplicateCuration = deprecateActiveDuplicates(normalized);
  const backfill = backfillActiveDeficits(duplicateCuration.rows);
  return {
    rows: backfill.rows,
    duplicateCuration,
    backfill,
  };
}

function printCurationResult({ duplicateCuration, backfill }) {
  if (duplicateCuration.deprecatedTotal > 0) {
    console.log(`deprecated active duplicate rows: ${formatCounts(duplicateCuration.deprecatedByLevel)}`);
  }
  if (backfill.addedTotal > 0) {
    console.log(`backfilled active study rows: ${formatCounts(backfill.addedByLevel)}`);
  }
}

async function ensureKanjidicFile(path) {
  if (existsSync(path)) return;
  ensureParent(path);
  console.log(`downloading KANJIDIC2: ${KANJIDIC_URL}`);
  const response = await fetch(KANJIDIC_URL);
  if (!response.ok) {
    throw new Error(`KANJIDIC2 download failed ${response.status}: ${await response.text()}`);
  }
  const body = Buffer.from(await response.arrayBuffer());
  writeFileSync(path, body);
}

function parseKanjidic(path) {
  const raw = readFileSync(path);
  const xml = path.endsWith('.gz') ? gunzipSync(raw).toString('utf8') : raw.toString('utf8');
  const out = new Map();

  for (const match of xml.matchAll(/<character>([\s\S]*?)<\/character>/g)) {
    const body = match[1];
    const literal = xmlText(firstTag(body, 'literal'));
    if (!literal) continue;

    const radicalNumber = Number(
      firstAttrTag(body, 'rad_value', 'rad_type', 'classical') ?? firstTag(body, 'rad_value') ?? 0,
    ) || null;
    const meaningsEn = unique(xmlAttrTags(body, 'meaning', 'm_lang', null).map(xmlText));
    const onyomi = unique(xmlAttrTags(body, 'reading', 'r_type', 'ja_on').map(xmlText));
    const kunyomi = unique(xmlAttrTags(body, 'reading', 'r_type', 'ja_kun').map(xmlText));
    const strokeCount = Number(firstTag(body, 'stroke_count') ?? 0) || null;
    const radName = xmlText(firstTag(body, 'rad_name'));

    out.set(literal, {
      literal,
      meaningsEn,
      onyomi,
      kunyomi,
      radical: radicalNumber ? radicalByNumber(radicalNumber) : '',
      radicalName: radName,
      radicalNumber,
      strokeCount,
    });
  }

  return out;
}

function buildKanjiQaRows(wordRows, kanjidic) {
  const needed = unique(normalizeQaRows(wordRows)
    .filter((row) => row.deprecated !== '1')
    .flatMap((row) => extractKanjiLiterals(row.surface, row.furigana)));
  const existing = existsSync(kanjiQaPath) ? readCsv(kanjiQaPath) : [];
  const byLiteral = new Map(existing.map((row) => [clean(row.literal), row]));
  const out = [];

  for (const literal of needed) {
    const entry = kanjidic.get(literal);
    if (!entry) continue;
    const current = byLiteral.get(literal);
    const meaningsKo = parseArrayish(current?.meanings_ko);
    const status = QA_STATUSES.has(clean(current?.qa_status)) ? clean(current?.qa_status) : 'auto';
    const qaNote = clean(current?.qa_note) || 'Auto draft: KANJIDIC2 readings/radical; Korean meaning draft derived from local Korean word gloss when available.';
    const shouldRegenerateDraft = status === 'auto' && (!current || qaNote.startsWith('Auto draft:'));
    const draftKo = meaningsKo.length > 0 && !shouldRegenerateDraft
      ? meaningsKo
      : deriveKanjiMeaningKo(literal, wordRows);

    out.push({
      literal,
      meanings_ko: JSON.stringify(draftKo),
      meanings_en: JSON.stringify(entry.meaningsEn),
      onyomi: JSON.stringify(entry.onyomi),
      kunyomi: JSON.stringify(entry.kunyomi),
      radical: clean(current?.radical) || entry.radical,
      radical_name_ko: clean(current?.radical_name_ko),
      radical_number: clean(current?.radical_number) || String(entry.radicalNumber ?? ''),
      stroke_count: clean(current?.stroke_count) || String(entry.strokeCount ?? ''),
      source: clean(current?.source) || 'kanjidic2',
      source_url: clean(current?.source_url) || KANJIDIC_URL,
      license: clean(current?.license) || KANJIDIC_LICENSE,
      qa_status: status,
      data_version: clean(current?.data_version) || String(DATA_VERSION),
      qa_note: qaNote,
    });
  }

  return out.sort((a, b) => a.literal.localeCompare(b.literal, 'ja'));
}

function deriveKanjiMeaningKo(literal, wordRows) {
  const candidates = normalizeQaRows(wordRows)
    .filter((row) =>
      row.deprecated !== '1' &&
      row.surface.includes(literal) &&
      (row.surface === literal || (extractKanjiLiterals(row.surface).length === 1 && row.surface.length <= 3)) &&
      clean(row.meaning_ko) &&
      !clean(row.meaning_ko).startsWith('[DRAFT MISSING]'))
    .sort((a, b) => {
      const exact = Number(b.surface === literal) - Number(a.surface === literal);
      if (exact !== 0) return exact;
      const singleKanjiWord =
        Number(extractKanjiLiterals(b.surface).length === 1) -
        Number(extractKanjiLiterals(a.surface).length === 1);
      if (singleKanjiWord !== 0) return singleKanjiWord;
      const qa = Number(b.qa_status === 'verified') - Number(a.qa_status === 'verified');
      if (qa !== 0) return qa;
      return a.surface.length - b.surface.length;
    });
  for (const row of candidates) {
    const values = splitMeanings(row.meaning_ko);
    if (values.length > 0) return values.slice(0, 3);
  }
  return [];
}

function splitMeanings(text) {
  return clean(text).split(/[,;、，]/).map((part) => part.trim()).filter(Boolean);
}

function readNaverExampleRows(path, wordRows) {
  if (!existsSync(path)) return [];
  const activeIds = new Set(
    normalizeQaRows(wordRows)
      .filter((row) => row.deprecated !== '1')
      .map((row) => row.id),
  );
  const seen = new Set();
  const out = [];
  for (const raw of readCsv(path)) {
    const row = normalizeNaverExampleRow(raw);
    if (!row.word_id || seen.has(row.word_id) || !activeIds.has(row.word_id)) continue;
    if (!row.jp || row.permission_status !== 'cleared' || row.qa_status === 'rejected') continue;
    seen.add(row.word_id);
    out.push(row);
  }
  return out.sort((a, b) => a.word_id.localeCompare(b.word_id));
}

function normalizeNaverExampleRow(row) {
  return {
    word_id: clean(row.word_id),
    jp: clean(row.jp),
    ko: clean(row.ko),
    source: clean(row.source) || 'naver-ja-dict',
    source_url: clean(row.source_url),
    license: clean(row.license) || 'owner-confirmed-cleared',
    permission_status: clean(row.permission_status) || 'pending',
    attribution: clean(row.attribution),
    captured_at: clean(row.captured_at) || String(Date.now()),
    qa_status: QA_STATUSES.has(clean(row.qa_status)) ? clean(row.qa_status) : 'auto',
    sort_order: clean(row.sort_order) || '0',
  };
}

function attachPrimaryExamples(wordRows, exampleRows) {
  const byWordId = new Map();
  for (const row of exampleRows) {
    if (!byWordId.has(row.word_id)) byWordId.set(row.word_id, row);
  }
  return wordRows.map((row) => {
    const example = byWordId.get(clean(row.id));
    if (!example) return row;
    return {
      ...row,
      example_jp: example.jp,
      example_ko: example.ko,
      example_jp_id: '',
      example_jp_author: example.attribution || 'NAVER 일본어사전',
      example_ko_id: '',
      example_ko_author: '',
      example_license: example.license || 'owner-confirmed-cleared',
    };
  });
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
    if (vocabularyExclusionReason({ surface, reading_kana: reading })) continue;

    const key = `${level}\t${surface}\t${reading}`;
    if (seen.has(key)) continue;
    seen.add(key);
    buckets[level].push({
      ...makeQaRow({
        id: makeId(level, buckets[level].length + 1, surface, reading),
        level,
        surface,
        reading,
        english,
        tags: ['draft-ko-missing'],
        qaNote: 'Korean meaning draft required',
      }),
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

function backfillActiveDeficits(rows) {
  const activeByLevel = countActiveByLevel(rows);
  const deficits = {};
  for (const level of LEVEL_ORDER) {
    deficits[level] = Math.max(0, TARGET_COUNTS[level] - activeByLevel[level]);
  }

  const addedTotal = Object.values(deficits).reduce((sum, n) => sum + n, 0);
  if (addedTotal === 0) {
    return { rows, addedTotal: 0, addedByLevel: zeroLevelCounts() };
  }
  if (!existsSync(sourcePath)) {
    throw new Error(`source CSV required for backfill: ${sourcePath}`);
  }

  const out = rows.map((r) => ({ ...r }));
  const sourceRows = readCsv(sourcePath);
  const seenWords = new Set(out.map((row) => duplicateWordKey(row)));
  const nextIndexByLevel = {};
  for (const level of LEVEL_ORDER) {
    nextIndexByLevel[level] = out.filter((row) => row.level === level).length + 1;
  }
  const addedByLevel = zeroLevelCounts();

  for (const source of sourceRows) {
    const level = clean(source['JLPT Level']);
    if (!(level in deficits) || deficits[level] <= 0) continue;

    const surface = clean(source.Original);
    const reading = clean(source.Furigana);
    const english = clean(source.English);
    if (!surface || !reading || !english) continue;
    if (vocabularyExclusionReason({ surface, reading_kana: reading })) continue;

    const key = duplicateWordKey({ surface, reading_kana: reading });
    if (seenWords.has(key)) continue;
    seenWords.add(key);

    out.push(normalizeQaRows([
      makeQaRow({
        id: makeId(level, nextIndexByLevel[level], surface, reading),
        level,
        surface,
        reading,
        english,
        tags: ['draft-ko-missing', 'backfill-replacement'],
        qaNote: 'Backfilled to maintain active 6,200 vocabulary target; Korean meaning draft required',
      }),
    ])[0]);
    nextIndexByLevel[level] += 1;
    deficits[level] -= 1;
    addedByLevel[level] += 1;
  }

  const missing = Object.entries(deficits).filter(([, n]) => n > 0);
  if (missing.length > 0) {
    throw new Error(`not enough non-duplicate replacement rows: ${formatCounts(Object.fromEntries(missing))}`);
  }

  return { rows: out, addedTotal, addedByLevel };
}

function deprecateActiveDuplicates(rows) {
  const out = rows.map((row, index) => ({ ...row, __index: index }));
  const replacementCapacity = estimateBackfillCapacity(out);
  const groups = new Map();
  for (const row of out) {
    if (row.deprecated === '1') continue;
    const key = duplicateWordKey(row);
    if (!key.trim()) continue;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const deprecatedByLevel = zeroLevelCounts();
  let deprecatedTotal = 0;
  const levelRank = Object.fromEntries(LEVEL_ORDER.map((level, index) => [level, index]));

  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const ordered = [...group].sort((a, b) => {
      const levelDelta = (levelRank[a.level] ?? 99) - (levelRank[b.level] ?? 99);
      if (levelDelta !== 0) return levelDelta;
      return a.__index - b.__index;
    });
    const keep = chooseDuplicateKeepRow(ordered, replacementCapacity);
    for (const row of ordered.filter((candidate) => candidate !== keep)) {
      row.deprecated = '1';
      row.tags = withJsonTag(row.tags, DUPLICATE_TAG);
      row.qa_note = appendQaNote(
        row.qa_note,
        `active 중복 표제어 대체: ${keep.level} ${keep.id} 유지`,
      );
      if (row.level in deprecatedByLevel) deprecatedByLevel[row.level] += 1;
      if (row.level in replacementCapacity) replacementCapacity[row.level] -= 1;
      deprecatedTotal += 1;
    }
  }

  return {
    rows: out.map(({ __index, ...row }) => row),
    deprecatedTotal,
    deprecatedByLevel,
  };
}

function chooseDuplicateKeepRow(ordered, replacementCapacity) {
  for (const keep of ordered) {
    const removals = ordered.filter((row) => row !== keep);
    if (removalsCanBeBackfilled(removals, replacementCapacity)) return keep;
  }
  return ordered[0];
}

function removalsCanBeBackfilled(removals, replacementCapacity) {
  const needed = zeroLevelCounts();
  for (const row of removals) {
    if (row.level in needed) needed[row.level] += 1;
  }
  return LEVEL_ORDER.every((level) => needed[level] <= (replacementCapacity[level] ?? 0));
}

function estimateBackfillCapacity(rows) {
  const capacity = zeroLevelCounts();
  if (!existsSync(sourcePath)) return capacity;

  const seenWords = new Set(rows.map((row) => duplicateWordKey(row)));
  for (const source of readCsv(sourcePath)) {
    const level = clean(source['JLPT Level']);
    if (!(level in capacity)) continue;

    const surface = clean(source.Original);
    const reading = clean(source.Furigana);
    const english = clean(source.English);
    if (!surface || !reading || !english) continue;
    if (vocabularyExclusionReason({ surface, reading_kana: reading })) continue;

    const key = duplicateWordKey({ surface, reading_kana: reading });
    if (seenWords.has(key)) continue;
    seenWords.add(key);
    capacity[level] += 1;
  }
  return capacity;
}

function makeQaRow({ id, level, surface, reading, english, tags, qaNote }) {
  return {
    id,
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
    tags: JSON.stringify(tags),
    data_version: String(DATA_VERSION),
    qa_note: qaNote,
  };
}

function countActiveByLevel(rows) {
  const counts = zeroLevelCounts();
  for (const row of rows) {
    if (row.deprecated !== '1' && row.level in counts) counts[row.level] += 1;
  }
  return counts;
}

function zeroLevelCounts() {
  return Object.fromEntries(LEVEL_ORDER.map((level) => [level, 0]));
}

function duplicateWordKey(row) {
  return `${clean(row.surface).normalize('NFKC')}\t${clean(row.reading_kana).normalize('NFKC')}`;
}

async function translateMissing(rows, { model, batchSize }) {
  const out = rows.map((r) => ({ ...r }));
  let translated = 0;
  for (let i = 0; i < out.length; i += batchSize) {
    const batch = out
      .slice(i, i + batchSize)
      .filter((r) => r.deprecated !== '1' && (!clean(r.meaning_ko) || r.qa_status === 'needs_review'));
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

function buildDatabase(rows, outPath, kanjiQaRows, naverExampleRows = []) {
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
    `CREATE TABLE kanji (
      literal TEXT PRIMARY KEY,
      meanings_ko TEXT NOT NULL,
      onyomi TEXT,
      kunyomi TEXT,
      radical TEXT,
      radical_name_ko TEXT,
      radical_number INTEGER,
      stroke_count INTEGER,
      source TEXT NOT NULL,
      source_url TEXT,
      license TEXT,
      qa_status TEXT NOT NULL CHECK (qa_status IN ('verified','auto','needs_review','rejected')),
      data_version INTEGER NOT NULL
    );`,
    'CREATE INDEX idx_kanji_qa ON kanji(qa_status);',
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
    `CREATE TABLE word_kanji (
      word_id TEXT NOT NULL,
      literal TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (word_id, literal, position),
      FOREIGN KEY (word_id) REFERENCES word(id),
      FOREIGN KEY (literal) REFERENCES kanji(literal)
    );`,
    'CREATE INDEX idx_word_kanji_word ON word_kanji(word_id, position);',
    'CREATE INDEX idx_word_kanji_literal ON word_kanji(literal);',
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
    `CREATE TABLE word_example (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id TEXT NOT NULL,
      jp TEXT NOT NULL,
      ko TEXT,
      source TEXT NOT NULL,
      source_url TEXT,
      license TEXT,
      permission_status TEXT NOT NULL CHECK (permission_status IN ('cleared','pending','blocked','self')),
      attribution TEXT,
      captured_at INTEGER,
      qa_status TEXT NOT NULL CHECK (qa_status IN ('verified','auto','needs_review','rejected')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (word_id) REFERENCES word(id)
    );`,
    'CREATE INDEX idx_word_example_word ON word_example(word_id, sort_order);',
    'CREATE INDEX idx_word_example_permission ON word_example(source, permission_status);',
    'CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT);',
    `INSERT INTO app_meta (key, value) VALUES
      ('schema_version', '2'),
      ('data_version', '${DATA_VERSION}'),
      ('source', 'kaggle:robinpourtaud/jlpt-words-by-level'),
      ('kanji_source', 'kanjidic2'),
      ('kanji_license', '${KANJIDIC_LICENSE}'),
      ('qa_policy', 'gpt_draft_human_verified_before_release');`,
  ]);

  const importCsv = writeWordImportCsv(rows);
  const kanjiImportCsv = writeKanjiImportCsv(kanjiQaRows);
  const wordKanjiImportCsv = writeWordKanjiImportCsv(rows, kanjiQaRows);
  const wordExampleImportCsv = writeWordExampleImportCsv(naverExampleRows);
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
     FROM word_import
     WHERE CAST(deprecated AS INTEGER) = 0;`,
    'DROP TABLE word_import;',
    `.import ${sqlQuote(kanjiImportCsv)} kanji_import`,
    `INSERT INTO kanji
      (literal, meanings_ko, onyomi, kunyomi, radical, radical_name_ko, radical_number,
       stroke_count, source, source_url, license, qa_status, data_version)
     SELECT literal, meanings_ko, nullif(onyomi, ''), nullif(kunyomi, ''), nullif(radical, ''),
       nullif(radical_name_ko, ''), CAST(nullif(radical_number, '') AS INTEGER),
       CAST(nullif(stroke_count, '') AS INTEGER),
       source, nullif(source_url, ''), nullif(license, ''), qa_status, CAST(data_version AS INTEGER)
     FROM kanji_import;`,
    'DROP TABLE kanji_import;',
    `.import ${sqlQuote(wordKanjiImportCsv)} word_kanji_import`,
    `INSERT INTO word_kanji (word_id, literal, position)
     SELECT word_id, literal, CAST(position AS INTEGER)
     FROM word_kanji_import;`,
    'DROP TABLE word_kanji_import;',
    `.import ${sqlQuote(wordExampleImportCsv)} word_example_import`,
    `INSERT INTO word_example
      (word_id, jp, ko, source, source_url, license, permission_status,
       attribution, captured_at, qa_status, sort_order)
     SELECT word_id, jp, nullif(ko, ''), source, nullif(source_url, ''),
       nullif(license, ''), permission_status, nullif(attribution, ''),
       CAST(nullif(captured_at, '') AS INTEGER), qa_status, CAST(sort_order AS INTEGER)
     FROM word_example_import
     WHERE permission_status = 'cleared'
       AND qa_status != 'rejected'
       AND word_id IN (SELECT id FROM word);`,
    'DROP TABLE word_example_import;',
    'PRAGMA user_version = 2;',
    'VACUUM;',
  ];
  execSql(tmp, insert);
  if (existsSync(importCsv)) rmSync(importCsv);
  if (existsSync(kanjiImportCsv)) rmSync(kanjiImportCsv);
  if (existsSync(wordKanjiImportCsv)) rmSync(wordKanjiImportCsv);
  if (existsSync(wordExampleImportCsv)) rmSync(wordExampleImportCsv);
  if (existsSync(outPath)) rmSync(outPath);
  renameSync(tmp, outPath);
}

function inspectDatabase(dbPath) {
  const count = (where = '1=1') =>
    Number(execSql(dbPath, [`SELECT COUNT(*) FROM word WHERE ${where};`], true).trim());
  const tableCount = (table, where = '1=1') =>
    Number(execSql(dbPath, [`SELECT COUNT(*) FROM ${table} WHERE ${where};`], true).trim());
  const levelCounts = {};
  for (const level of LEVEL_ORDER) {
    levelCounts[level] = count(`level='${level}' AND deprecated=0`);
  }
  const qa = {};
  for (const status of QA_STATUSES) {
    qa[status] = count(`qa_status='${status}'`);
  }
  const activeQa = {};
  for (const status of QA_STATUSES) {
    activeQa[status] = count(`qa_status='${status}' AND deprecated=0`);
  }
  activeQa.nonVerified = count(`qa_status!='verified' AND deprecated=0`);
  const duplicateGroups = Number(execSql(
    dbPath,
    [
      `SELECT COUNT(*) FROM (
        SELECT surface, reading_kana
        FROM word
        WHERE deprecated=0
        GROUP BY surface, reading_kana
        HAVING COUNT(*) > 1
      );`,
    ],
    true,
  ).trim());
  const duplicateExtraRows = Number(execSql(
    dbPath,
    [
      `SELECT COALESCE(SUM(c - 1), 0) FROM (
        SELECT COUNT(*) AS c
        FROM word
        WHERE deprecated=0
        GROUP BY surface, reading_kana
        HAVING COUNT(*) > 1
      );`,
    ],
    true,
  ).trim());
  const kanjiQa = {};
  for (const status of QA_STATUSES) {
    kanjiQa[status] = tableCount('kanji', `qa_status='${status}'`);
  }
  return {
    path: rel(dbPath),
    bytes: existsSync(dbPath) ? readFileSync(dbPath).byteLength : 0,
    total: count('deprecated=0'),
    deprecated: count('deprecated=1'),
    vocabularyExcluded: count(`deprecated=1 AND tags LIKE '%${NON_VOCAB_TAG}%'`),
    levels: levelCounts,
    qa,
    activeQa,
    activeDuplicateGroups: duplicateGroups,
    activeDuplicateExtraRows: duplicateExtraRows,
    kanji: {
      total: tableCount('kanji'),
      qa: kanjiQa,
      wordLinks: tableCount('word_kanji'),
      kanjiBearingWords: Number(execSql(
        dbPath,
        ['SELECT COUNT(DISTINCT word_id) FROM word_kanji;'],
        true,
      ).trim()),
    },
    examples: {
      total: tableCount('word_example'),
      naver: tableCount('word_example', `source='naver-ja-dict'`),
      naverCleared: tableCount(
        'word_example',
        `source='naver-ja-dict' AND permission_status='cleared'`,
      ),
      words: Number(execSql(
        dbPath,
        ['SELECT COUNT(DISTINCT word_id) FROM word_example;'],
        true,
      ).trim()),
    },
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

function writeKanjiImportCsv(rows) {
  const p = resolve(ROOT, 'data/track-a/.kanji_import.csv');
  ensureParent(p);
  const headers = [
    'literal',
    'meanings_ko',
    'onyomi',
    'kunyomi',
    'radical',
    'radical_name_ko',
    'radical_number',
    'stroke_count',
    'source',
    'source_url',
    'license',
    'qa_status',
    'data_version',
  ];
  const csv = [headers.join(',')];
  for (const row of rows) {
    csv.push(headers.map((h) => csvEscape(row[h] ?? '')).join(','));
  }
  writeFileSync(p, `${csv.join('\n')}\n`);
  return p;
}

function writeWordKanjiImportCsv(wordRows, kanjiRows) {
  const p = resolve(ROOT, 'data/track-a/.word_kanji_import.csv');
  ensureParent(p);
  const available = new Set(kanjiRows.map((row) => row.literal));
  const headers = ['word_id', 'literal', 'position'];
  const csv = [headers.join(',')];

  for (const row of normalizeQaRows(wordRows)) {
    if (row.deprecated === '1') continue;
    const literals = extractKanjiLiterals(row.surface, row.furigana)
      .filter((literal) => available.has(literal));
    literals.forEach((literal, position) => {
      csv.push([row.id, literal, String(position)].map(csvEscape).join(','));
    });
  }

  writeFileSync(p, `${csv.join('\n')}\n`);
  return p;
}

function writeWordExampleImportCsv(exampleRows) {
  const p = resolve(ROOT, 'data/track-a/.word_example_import.csv');
  ensureParent(p);
  const headers = [
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
  ];
  const csv = [headers.join(',')];
  for (const row of exampleRows) {
    csv.push(headers.map((h) => csvEscape(row[h] ?? '')).join(','));
  }
  writeFileSync(p, `${csv.join('\n')}\n`);
  return p;
}

function writeQaCsv(path, rows) {
  writeFileSync(path, renderQaCsv(rows));
}

function writeQaCsvIfChanged(path, rows) {
  const next = renderQaCsv(rows);
  if (existsSync(path) && readFileSync(path, 'utf8') === next) return false;
  writeFileSync(path, next);
  return true;
}

function writeKanjiQaCsvIfChanged(path, rows) {
  const next = renderKanjiQaCsv(rows);
  if (existsSync(path) && readFileSync(path, 'utf8') === next) return false;
  writeFileSync(path, next);
  return true;
}

function renderQaCsv(rows) {
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
  return `${csv.join('\n')}\n`;
}

function renderKanjiQaCsv(rows) {
  const headers = [
    'literal',
    'meanings_ko',
    'meanings_en',
    'onyomi',
    'kunyomi',
    'radical',
    'radical_name_ko',
    'radical_number',
    'stroke_count',
    'source',
    'source_url',
    'license',
    'qa_status',
    'data_version',
    'qa_note',
  ];
  const csv = [headers.join(',')];
  for (const row of rows) {
    csv.push(headers.map((h) => csvEscape(row[h] ?? '')).join(','));
  }
  return `${csv.join('\n')}\n`;
}

function normalizeQaRows(rows) {
  return rows.map((row) => {
    const status = QA_STATUSES.has(clean(row.qa_status)) ? clean(row.qa_status) : 'needs_review';
    const normalized = {
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
    return applyVocabularyCuration(normalized);
  });
}

function applyVocabularyCuration(row) {
  const reason = vocabularyExclusionReason(row);
  if (!reason) return row;
  return {
    ...row,
    deprecated: '1',
    tags: withJsonTag(row.tags, NON_VOCAB_TAG),
    qa_note: appendQaNote(row.qa_note, `단어형 항목 아님: ${reason}`),
  };
}

function vocabularyExclusionReason(row) {
  const surface = clean(row.surface);
  const reading = clean(row.reading_kana);
  if (/[~～〜]/.test(surface) || /[~～〜]/.test(reading)) {
    return '표면형/읽기에 ～ 또는 〜 자리표시자가 있어 문법·접사 패턴으로 분류';
  }
  if (/[()（）]/.test(surface)) {
    return '표면형에 괄호 문맥이 있어 독립 단어 표제어가 아님';
  }
  return '';
}

function withJsonTag(tags, tag) {
  let values = [];
  try {
    const parsed = JSON.parse(clean(tags) || '[]');
    if (Array.isArray(parsed)) values = parsed.filter((v) => typeof v === 'string');
  } catch {
    values = [];
  }
  if (!values.includes(tag)) values.push(tag);
  return JSON.stringify(values);
}

function appendQaNote(note, addition) {
  const current = clean(note);
  if (!current) return addition;
  if (current.includes(addition)) return current;
  return `${current}; ${addition}`;
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

function extractKanjiLiterals(...texts) {
  const seen = new Set();
  const out = [];
  const re = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/gu;
  for (const text of texts) {
    for (const match of clean(text).matchAll(re)) {
      const literal = match[0];
      if (seen.has(literal)) continue;
      seen.add(literal);
      out.push(literal);
    }
  }
  return out;
}

function firstTag(body, tag) {
  const match = body?.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`));
  return match?.[1] ?? '';
}

function firstAttrTag(body, tag, attrName, attrValue) {
  return xmlAttrTags(body, tag, attrName, attrValue)[0] ?? '';
}

function xmlAttrTags(body, tag, attrName, attrValue) {
  const out = [];
  const re = new RegExp(`<${tag}([^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'g');
  for (const match of body.matchAll(re)) {
    const attrs = match[1] ?? '';
    const value = attrValue === null ? !attrs.includes(`${attrName}=`) : attrs.includes(`${attrName}="${attrValue}"`);
    if (value) out.push(match[2] ?? '');
  }
  return out;
}

function xmlText(value) {
  return clean(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseArrayish(value) {
  const text = clean(value);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.map(clean).filter(Boolean) : [];
  } catch {
    return splitMeanings(text);
  }
}

function radicalByNumber(n) {
  return Array.from(KANJI_RADICALS)[n - 1] ?? '';
}

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
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
    else if (a === '--skip-kanjidic' || a === '--skipKanjidic') out.skipKanjidic = true;
    else if (a === '--naver-examples') out.naverExamples = argv[++i];
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
  --kanjiQa PATH    Kanji QA CSV path (default: ${rel(DEFAULT_KANJI_QA)})
  --naverExamples PATH
                   NAVER examples QA CSV path (default: ${rel(DEFAULT_NAVER_EXAMPLES)})
  --kanjidic PATH   KANJIDIC2 XML or XML.GZ path (default: ${rel(DEFAULT_KANJIDIC)})
  --skip-kanjidic   Build empty kanji tables without downloading/parsing KANJIDIC2
  --translate       Draft missing Korean meanings via OpenAI Responses API
  --model MODEL     OpenAI model (default: gpt-4o-mini or OPENAI_MODEL)
  --batchSize N     Translation batch size (default: 40)
  --rebuild-qa      Recreate QA CSV from source CSV
`);
}

function printReport(report) {
  console.log('\nTrack A DB report');
  console.log(`active total: ${report.total}`);
  console.log(`deprecated: ${report.deprecated} (vocabulary-excluded=${report.vocabularyExcluded})`);
  console.log(`levels: ${formatCounts(report.levels)}`);
  console.log(`qa(all): ${formatCounts(report.qa)}`);
  console.log(`qa(active): ${formatCounts(report.activeQa)}`);
  console.log(`kanji: total=${report.kanji.total}, word_links=${report.kanji.wordLinks}, words=${report.kanji.kanjiBearingWords}`);
  console.log(`kanji qa: ${formatCounts(report.kanji.qa)}`);
  console.log(`examples: total=${report.examples.total}, naver=${report.examples.naver}, words=${report.examples.words}`);
}

function formatCounts(counts) {
  return Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(', ');
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

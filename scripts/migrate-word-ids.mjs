// One-time migration: rewrite word ids from the legacy `${level}-${seq}-${slug}`
// scheme to the stable hash scheme (makeId = sha256(NFKC(surface)⊕NFKC(reading))).
//
// Why: legacy ids encode JLPT level + positional index, so a level correction or any
// dedup/backfill reordering changed a word's id and orphaned its curated data. The new
// id depends only on surface+reading, so the same word keeps the same id across rebuilds.
//
// Scope — rewrites ids consistently across every committed file that references them:
//   - data/track-a/jlpt_qa_work.csv          (id, primary key; 7002 human-verified rows)
//   - data/track-a/naver_examples_qa_work.csv (word_id FK)
//   - data/track-a/vocab_audit_flagged.csv    (id)
//   - data/track-a/reading_chapters.json      (keys are word ids)
//
// Cross-level duplicates (same surface+reading in two levels = one active + one deprecated)
// collapse to a single row under the new id: keep the active row, drop the deprecated twin.
//
// Usage:
//   node scripts/migrate-word-ids.mjs            # dry-run, prints impact only
//   node scripts/migrate-word-ids.mjs --apply    # write changes (git-tracked, reversible)

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');

const JLPT = resolve(ROOT, 'data/track-a/jlpt_qa_work.csv');
const NAVER = resolve(ROOT, 'data/track-a/naver_examples_qa_work.csv');
const VOCAB = resolve(ROOT, 'data/track-a/vocab_audit_flagged.csv');
const CHAPTERS = resolve(ROOT, 'data/track-a/reading_chapters.json');

// ── helpers (identical semantics to scripts/build-jlpt-db.mjs) ────────────────
const clean = (v) => String(v ?? '').trim();

function makeId(surface, reading, senseKey = '') {
  const norm = (s) => clean(s).normalize('NFKC');
  const SEP = '';
  const basis = senseKey
    ? `${norm(surface)}${SEP}${norm(reading)}${SEP}${senseKey}`
    : `${norm(surface)}${SEP}${norm(reading)}`;
  return `w_${createHash('sha256').update(basis).digest('hex').slice(0, 16)}`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function readCsv(path) {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  const grid = parseCsv(text);
  if (grid.length === 0) return { headers: [], rows: [] };
  const headers = grid[0].map(clean);
  const rows = grid.slice(1).filter((r) => r.some((v) => clean(v))).map((r) => {
    const obj = {};
    for (let i = 0; i < headers.length; i += 1) obj[headers[i]] = r[i] ?? '';
    return obj;
  });
  return { headers, rows };
}

const csvEscape = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function writeCsv(path, headers, rows) {
  const out = [headers.join(',')];
  for (const row of rows) out.push(headers.map((h) => csvEscape(row[h] ?? '')).join(','));
  writeFileSync(path, `${out.join('\n')}\n`);
}

const isActive = (row) => clean(row.deprecated) === '0' || clean(row.deprecated) === '';

// ── 1. build old→new id map from jlpt_qa_work.csv ─────────────────────────────
const { headers: jlptHeaders, rows: jlptRows } = readCsv(JLPT);

const byNew = new Map(); // newId -> rows[]
for (const row of jlptRows) {
  const newId = makeId(row.surface, row.reading_kana);
  if (!byNew.has(newId)) byNew.set(newId, []);
  byNew.get(newId).push(row);
}

const oldToNew = new Map();
const keptRows = [];
const droppedDupes = [];
const trueCollisions = [];

for (const row of jlptRows) oldToNew.set(clean(row.id), makeId(row.surface, row.reading_kana));

for (const [newId, group] of byNew) {
  if (group.length === 1) {
    keptRows.push({ row: group[0], newId });
    continue;
  }
  const actives = group.filter(isActive);
  const distinctMeanings = new Set(actives.map((r) => clean(r.meaning_ko)));
  if (actives.length > 1 && distinctMeanings.size > 1) {
    // Genuine homograph: same surface+reading, different meaning → needs a senseKey.
    trueCollisions.push({ newId, group });
    continue;
  }
  const keep = actives[0] ?? group[0];
  keptRows.push({ row: keep, newId });
  for (const r of group) if (r !== keep) droppedDupes.push(r);
}

if (trueCollisions.length > 0) {
  console.error(`\n✖ TRUE homograph collisions (${trueCollisions.length}) — assign a senseKey before migrating:`);
  for (const c of trueCollisions.slice(0, 20)) {
    console.error(`  ${c.newId}:`, c.group.map((r) => `${r.id}(${clean(r.meaning_ko).slice(0, 12)})`).join(' | '));
  }
  process.exit(1);
}

// Preserve original row order among kept rows.
const keptByOriginal = jlptRows
  .map((row) => keptRows.find((k) => k.row === row))
  .filter(Boolean);

const newJlptRows = keptByOriginal.map(({ row, newId }) => ({ ...row, id: newId }));

// Sanity: no duplicate new ids after collapse.
const seenNew = new Set();
for (const r of newJlptRows) {
  if (seenNew.has(r.id)) throw new Error(`duplicate new id after collapse: ${r.id}`);
  seenNew.add(r.id);
}

// ── 2. remap referencing files ────────────────────────────────────────────────
function remapColumn(path, col) {
  const { headers, rows } = readCsv(path);
  let remapped = 0;
  const orphans = [];
  for (const row of rows) {
    const old = clean(row[col]);
    const next = oldToNew.get(old);
    if (next) { if (next !== old) remapped += 1; row[col] = next; }
    else orphans.push(old);
  }
  return { headers, rows, remapped, orphans };
}

const naver = remapColumn(NAVER, 'word_id');
const vocab = remapColumn(VOCAB, 'id');

// reading_chapters.json — object keyed by word id.
const chapters = JSON.parse(readFileSync(CHAPTERS, 'utf8'));
const newChapters = {};
let chRemapped = 0;
const chOrphans = [];
const chKeyCollisions = [];
for (const [oldKey, val] of Object.entries(chapters)) {
  const next = oldToNew.get(clean(oldKey));
  if (!next) { chOrphans.push(oldKey); newChapters[oldKey] = val; continue; }
  if (next !== oldKey) chRemapped += 1;
  if (next in newChapters) { chKeyCollisions.push(oldKey); continue; } // dropped dupe collapsed
  newChapters[next] = val;
}

// ── 3. report ─────────────────────────────────────────────────────────────────
console.log(`\n${APPLY ? '✏️  APPLY' : '🔍 DRY-RUN'} — word id migration\n${'─'.repeat(50)}`);
console.log(`jlpt_qa_work.csv : ${jlptRows.length} → ${newJlptRows.length} rows`);
console.log(`  collapsed cross-level dupes (deprecated twin dropped): ${droppedDupes.length}`);
console.log(`  true homograph collisions: ${trueCollisions.length}`);
console.log(`naver_examples   : ${naver.rows.length} rows, word_id remapped ${naver.remapped}, orphans ${naver.orphans.length}`);
console.log(`vocab_audit      : ${vocab.rows.length} rows, id remapped ${vocab.remapped}, orphans ${vocab.orphans.length}`);
console.log(`reading_chapters : ${Object.keys(chapters).length} → ${Object.keys(newChapters).length} keys, remapped ${chRemapped}, orphans ${chOrphans.length}, collapsed ${chKeyCollisions.length}`);
if (naver.orphans.length) console.log(`  naver orphan sample:`, naver.orphans.slice(0, 5));
if (vocab.orphans.length) console.log(`  vocab orphan sample:`, vocab.orphans.slice(0, 5));
if (chOrphans.length) console.log(`  chapters orphan sample:`, chOrphans.slice(0, 5));
console.log(`sample id remap:`, jlptRows.slice(0, 3).map((r) => `${r.id} → ${oldToNew.get(clean(r.id))}`));

if (!APPLY) {
  console.log(`\nDry-run only. Re-run with --apply to write (git-tracked, reversible).`);
  process.exit(0);
}

writeCsv(JLPT, jlptHeaders, newJlptRows);
writeCsv(NAVER, naver.headers, naver.rows);
writeCsv(VOCAB, vocab.headers, vocab.rows);

// reading_chapters.json: rewrite keys via textual replacement to preserve the exact
// file formatting (generated by gen-reading-chapters.py). Safe only when no keys
// collapse onto each other — otherwise we'd leave duplicate JSON keys.
if (chKeyCollisions.length > 0) {
  throw new Error(`reading_chapters has ${chKeyCollisions.length} key collisions — cannot textual-replace; rebuild instead`);
}
let chaptersText = readFileSync(CHAPTERS, 'utf8');
for (const [oldKey, val] of Object.entries(chapters)) {
  const next = oldToNew.get(clean(oldKey));
  if (!next || next === oldKey) continue;
  const before = chaptersText;
  chaptersText = chaptersText.replace(`"${oldKey}":`, `"${next}":`);
  if (chaptersText === before) throw new Error(`reading_chapters key not found for replace: ${oldKey}`);
  void val;
}
writeFileSync(CHAPTERS, chaptersText);
console.log(`\n✅ Wrote 4 files. Verify with: git diff --stat data/track-a/`);

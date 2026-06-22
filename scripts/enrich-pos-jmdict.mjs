#!/usr/bin/env node
// POS enrichment: derive part_of_speech for vocab rows from EDRDG JMdict_e.
// inferPartOfSpeech (build) only guesses from English gloss, so most adjectives
// fall back to 'noun'. JMdict carries per-entry <pos> tags → accurate labels.
//
// Usage: node scripts/enrich-pos-jmdict.mjs [--dry]
//   reads/writes data/track-a/jlpt_qa_work.csv (active rows only).
//   JMdict cache: .cache/JMdict_e.gz (auto-download if missing).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CSV = resolve(ROOT, 'data/track-a/jlpt_qa_work.csv');
const JMDICT = resolve(ROOT, '.cache/JMdict_e.gz');
const JMDICT_URL = 'http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz';
const dry = process.argv.includes('--dry');

// JMdict <pos> entity → our canonical label (priority: first matching pos wins).
function mapPos(tag) {
  if (/^adj-/.test(tag)) return 'adjective';
  if (/^(v[0-9]|v[0-9].*|vk|vs|vs-.|vz|vn|vr|vt|vi|aux-v)$/.test(tag)) return 'verb';
  if (tag === 'adv' || tag === 'adv-to') return 'adverb';
  if (tag === 'pn') return 'pronoun';
  if (tag === 'int') return 'interjection';
  if (tag === 'conj') return 'conjunction';
  if (tag === 'prt') return 'particle';
  if (tag === 'ctr') return 'counter';
  if (tag === 'pref') return 'prefix';
  if (tag === 'suf' || tag === 'n-suf') return 'suffix';
  if (tag === 'exp') return 'expression';
  if (tag === 'num') return 'numeral';
  if (/^n/.test(tag)) return 'noun'; // n, n-pref, n-t, etc.
  return null;
}

async function ensureJmdict() {
  if (existsSync(JMDICT)) return;
  console.log(`downloading JMdict_e: ${JMDICT_URL}`);
  const res = await fetch(JMDICT_URL);
  if (!res.ok) throw new Error(`JMdict download failed ${res.status}`);
  writeFileSync(JMDICT, Buffer.from(await res.arrayBuffer()));
}

function parseJmdict() {
  const xml = gunzipSync(readFileSync(JMDICT)).toString('utf8');
  const byKebReb = new Map(); // `${keb}\t${reb}` -> label
  const byReb = new Map(); // `${reb}` -> label (kana fallback)
  let entries = 0;

  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const body = m[1];
    const kebs = [...body.matchAll(/<keb>(.*?)<\/keb>/g)].map((x) => x[1]);
    const rebs = [...body.matchAll(/<reb>(.*?)<\/reb>/g)].map((x) => x[1]);
    // first sense's pos tags (entity refs render as &tag; inside <pos>)
    const sense = body.match(/<sense>([\s\S]*?)<\/sense>/);
    if (!sense) continue;
    const posTags = [...sense[1].matchAll(/<pos>&(.*?);<\/pos>/g)].map((x) => x[1]);
    // Respect JMdict order, but 'exp' is often a wrapper — only use it as last resort.
    let label = null;
    let expFallback = null;
    for (const t of posTags) {
      const l = mapPos(t);
      if (!l) continue;
      if (l === 'expression') { expFallback ??= l; continue; }
      label = l;
      break;
    }
    label = label ?? expFallback;
    if (!label) continue;
    entries += 1;
    for (const reb of rebs) {
      if (!byReb.has(reb)) byReb.set(reb, label);
      for (const keb of kebs) {
        const k = `${keb}\t${reb}`;
        if (!byKebReb.has(k)) byKebReb.set(k, label);
      }
    }
  }
  return { byKebReb, byReb, entries };
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function csvCell(v) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

async function main() {
  await ensureJmdict();
  const { byKebReb, byReb, entries } = parseJmdict();
  console.log(`JMdict parsed: ${entries} entries with mapped POS`);

  const lines = readFileSync(CSV, 'utf8').split('\n');
  const header = splitCsvLine(lines[0]);
  const iSurface = header.indexOf('surface');
  const iReading = header.indexOf('reading_kana');
  const iPos = header.indexOf('part_of_speech');
  const iDep = header.indexOf('deprecated');

  let changed = 0;
  let matched = 0;
  const changes = [];
  for (let li = 1; li < lines.length; li += 1) {
    if (!lines[li].trim()) continue;
    const cols = splitCsvLine(lines[li]);
    if (cols.length < header.length) continue;
    if (cols[iDep] === '1') continue;
    const surface = cols[iSurface];
    const reading = cols[iReading].replace(/\s*\(する\)\s*/, '').split(/[;；]/)[0].trim();
    const label =
      byKebReb.get(`${surface}\t${reading}`) ??
      byKebReb.get(`${surface}\t${cols[iReading].trim()}`) ??
      byReb.get(reading) ??
      byReb.get(surface); // kana-surface words
    if (!label) continue;
    matched += 1;
    if (cols[iPos] !== label) {
      changes.push(`${surface}(${reading}) ${cols[iPos]}→${label}`);
      cols[iPos] = label;
      lines[li] = cols.map(csvCell).join(',');
      changed += 1;
    }
  }

  console.log(`matched in JMdict: ${matched}, POS changed: ${changed}`);
  console.log(changes.slice(0, 40).map((c) => '  ' + c).join('\n'));
  if (dry) { console.log('(dry run — not written)'); return; }
  writeFileSync(CSV, lines.join('\n'));
  console.log(`updated ${CSV}`);
}

await main();

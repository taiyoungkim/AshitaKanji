// One-time companion to scripts/migrate-word-ids.mjs: rename pre-generated TTS
// audio files from legacy word ids to the new stable hash ids, then regenerate
// the audio map. Without this, every pre-generated mp3 misses lookup (keyed by
// old id) and playback silently falls back to expo-speech.
//
// The word-id migration already rewrote jlpt_qa_work.csv, so the old→new map is
// reconstructed from the ORIGINAL csv at git HEAD (audio filenames still use old ids).
//
// Usage:
//   node scripts/migrate-audio-ids.mjs            # dry-run
//   node scripts/migrate-audio-ids.mjs --apply    # rename files + regenerate map
//
// NOTE: assets/audio/** is gitignored (not reversible via git). --apply backs up
// to assets/audio.bak/ first.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');
const AUDIO = resolve(ROOT, 'assets/audio');

const clean = (v) => String(v ?? '').trim();
function makeId(surface, reading, senseKey = '') {
  const norm = (s) => clean(s).normalize('NFKC');
  const SEP = '\u0001'; // MUST match scripts/build-jlpt-db.mjs makeId separator
  const basis = senseKey
    ? `${norm(surface)}${SEP}${norm(reading)}${SEP}${senseKey}`
    : `${norm(surface)}${SEP}${norm(reading)}`;
  return `w_${createHash('sha256').update(basis).digest('hex').slice(0, 16)}`;
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
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

// ── old→new id map from the ORIGINAL csv (git HEAD) ──────────────────────────
const originalCsv = execFileSync('git', ['show', 'HEAD:data/track-a/jlpt_qa_work.csv'], {
  cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
});
const grid = parseCsv(originalCsv.replace(/^﻿/, ''));
const headers = grid[0].map(clean);
const idx = (h) => headers.indexOf(h);
const oldToNew = new Map();
for (const r of grid.slice(1)) {
  if (!r.some((v) => clean(v))) continue;
  const oldId = clean(r[idx('id')]);
  if (!oldId) continue;
  oldToNew.set(oldId, makeId(r[idx('surface')], r[idx('reading_kana')]));
}

// ── plan renames per kind ─────────────────────────────────────────────────────
function plan(kind) {
  const dir = resolve(AUDIO, kind);
  if (!existsSync(dir)) return { kind, renames: [], dupes: [], orphans: [] };
  const files = readdirSync(dir).filter((f) => f.endsWith('.mp3'));
  const renames = [], dupes = [], orphans = [];
  const targetSeen = new Set();
  for (const f of files) {
    const oldId = f.slice(0, -4);
    const newId = oldToNew.get(oldId);
    if (!newId) { orphans.push(f); continue; }
    if (oldId === newId) continue; // already migrated
    const target = `${newId}.mp3`;
    if (targetSeen.has(target)) { dupes.push(f); continue; } // collapsed duplicate twin
    targetSeen.add(target);
    renames.push({ from: f, to: target });
  }
  return { kind, dir, renames, dupes, orphans };
}

const plans = [plan('words'), plan('examples')];

console.log(`\n${APPLY ? '✏️  APPLY' : '🔍 DRY-RUN'} — audio id migration\n${'─'.repeat(50)}`);
for (const p of plans) {
  console.log(`${p.kind}: rename ${p.renames.length}, drop dup ${p.dupes.length}, orphan ${p.orphans.length}`);
  if (p.orphans.length) console.log(`  orphan sample:`, p.orphans.slice(0, 3));
  if (p.dupes.length) console.log(`  dup sample:`, p.dupes.slice(0, 3));
}
if (plans[0].renames[0]) {
  console.log(`sample rename: ${plans[0].renames[0].from} → ${plans[0].renames[0].to}`);
}

if (!APPLY) {
  console.log(`\nDry-run only. Re-run with --apply (backs up to assets/audio.bak/ first).`);
  process.exit(0);
}

// ── apply: backup, rename, drop dupes, regenerate map ─────────────────────────
const backup = resolve(ROOT, 'assets/audio.bak');
if (!existsSync(backup)) { cpSync(AUDIO, backup, { recursive: true }); console.log(`backed up → ${backup}`); }

for (const p of plans) {
  for (const { from, to } of p.renames) renameSync(resolve(p.dir, from), resolve(p.dir, to));
  for (const f of p.dupes) rmSync(resolve(p.dir, f));
}
console.log('renamed + dropped dupes. regenerating audio map…');
execFileSync('node', ['scripts/gen-audio-map.mjs'], { cwd: ROOT, stdio: 'inherit' });
console.log('\n✅ audio migration complete.');

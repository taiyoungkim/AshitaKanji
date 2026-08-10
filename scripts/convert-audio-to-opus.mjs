#!/usr/bin/env node
/**
 * Convert bundled TTS MP3 files to Android-friendly Ogg/Opus assets.
 *
 * MP3 sources remain in place for iOS/web. Android uses the generated .ogg
 * files through audioMap.gen.android.ts.
 *
 * Usage:
 *   node scripts/convert-audio-to-opus.mjs
 *   node scripts/convert-audio-to-opus.mjs --limit 60
 *   node scripts/convert-audio-to-opus.mjs --verify-only
 */

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO_ROOT = resolve(ROOT, 'assets/audio');
const DB = resolve(ROOT, 'assets/jlpt.db');

function optionValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

const bitrate = optionValue('--bitrate', '24k');
const concurrency = Number(optionValue('--concurrency', '6'));
const limit = Number(optionValue('--limit', '0'));
const idsValue = optionValue('--ids', '');
const selectedIds = idsValue
  ? new Set(idsValue.split(',').map((id) => id.trim()).filter(Boolean))
  : null;
const verifyOnly = process.argv.includes('--verify-only');
const allFiles = process.argv.includes('--all-files');
const force = process.argv.includes('--force');

if (!/^\d+k$/.test(bitrate)) throw new Error('--bitrate must look like 24k');
if (!Number.isInteger(concurrency) || concurrency < 1) {
  throw new Error('--concurrency must be a positive integer');
}
if (!Number.isInteger(limit) || limit < 0) throw new Error('--limit must be zero or greater');

function ensureTool(name) {
  execFileSync(name, ['-version'], { stdio: 'ignore' });
}

function activeWordIds() {
  if (allFiles) return null;
  const output = execFileSync('sqlite3', [DB, 'SELECT id FROM word WHERE deprecated=0;'], {
    encoding: 'utf8',
  });
  return new Set(output.split('\n').map((id) => id.trim()).filter(Boolean));
}

function collectJobs() {
  const activeIds = activeWordIds();
  const jobsByKind = { words: [], examples: [] };
  for (const kind of ['words', 'examples']) {
    const dir = resolve(AUDIO_ROOT, kind);
    if (!existsSync(dir)) continue;
    for (const filename of readdirSync(dir).filter((name) => name.endsWith('.mp3')).sort()) {
      const id = filename.slice(0, -4);
      if (activeIds != null && !activeIds.has(id)) continue;
      if (selectedIds != null && !selectedIds.has(id)) continue;
      jobsByKind[kind].push({
        kind,
        id,
        source: resolve(dir, filename),
        target: resolve(dir, `${id}.ogg`),
      });
    }
  }
  if (limit > 0) {
    const wordLimit = Math.ceil(limit / 2);
    const exampleLimit = Math.floor(limit / 2);
    return [
      ...jobsByKind.words.slice(0, wordLimit),
      ...jobsByKind.examples.slice(0, exampleLimit),
    ];
  }
  return [...jobsByKind.words, ...jobsByKind.examples];
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      if (stderr.length < 12_000) stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} exited ${code}: ${stderr.trim()}`));
    });
  });
}

async function convert(job) {
  if (!force && existsSync(job.target) && statSync(job.target).size > 0) return 'skipped';
  const temporary = `${job.target}.part`;
  if (existsSync(temporary)) unlinkSync(temporary);
  try {
    await run('ffmpeg', [
      '-y',
      '-v',
      'error',
      '-i',
      job.source,
      '-vn',
      '-map_metadata',
      '-1',
      '-ac',
      '1',
      '-ar',
      '48000',
      '-c:a',
      'libopus',
      '-application',
      'voip',
      '-b:a',
      bitrate,
      '-vbr',
      'on',
      '-compression_level',
      '10',
      '-f',
      'ogg',
      temporary,
    ]);
    renameSync(temporary, job.target);
    return 'converted';
  } catch (error) {
    if (existsSync(temporary)) unlinkSync(temporary);
    throw error;
  }
}

async function probe(job) {
  if (!existsSync(job.target)) throw new Error('missing Ogg/Opus file');
  let stdout = '';
  await new Promise((resolvePromise, reject) => {
    const child = spawn(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'stream=codec_name,sample_rate,channels:format=duration,size',
        '-of',
        'json',
        job.target,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`ffprobe exited ${code}: ${stderr.trim()}`));
    });
  });
  const payload = JSON.parse(stdout);
  const stream = payload.streams?.[0];
  const format = payload.format ?? {};
  if (
    stream?.codec_name !== 'opus' ||
    Number(stream.sample_rate) !== 48000 ||
    Number(stream.channels) !== 1 ||
    Number(format.duration) <= 0 ||
    Number(format.size) <= 0
  ) {
    throw new Error(`invalid Ogg/Opus metadata: ${stdout.trim()}`);
  }
  return Number(format.size);
}

async function runPool(jobs, operation) {
  let cursor = 0;
  let completed = 0;
  const results = [];
  const failures = [];
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= jobs.length) return;
      const job = jobs[index];
      try {
        results[index] = await operation(job);
      } catch (error) {
        failures.push({ job, error });
      }
      completed += 1;
      if (completed % 250 === 0 || completed === jobs.length) {
        console.log(`progress ${completed}/${jobs.length} failures=${failures.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker()));
  return { results, failures };
}

async function main() {
  ensureTool('ffmpeg');
  ensureTool('ffprobe');
  const jobs = collectJobs();
  if (jobs.length === 0) throw new Error('No matching MP3 files found');

  if (!verifyOnly) {
    const sourceBytes = jobs.reduce((sum, job) => sum + statSync(job.source).size, 0);
    console.log(
      `convert jobs=${jobs.length} bitrate=${bitrate} concurrency=${concurrency} ` +
        `scope=${allFiles ? 'all-files' : 'active-db-only'}`,
    );
    const { results, failures } = await runPool(jobs, convert);
    if (failures.length > 0) {
      for (const { job, error } of failures.slice(0, 20)) {
        console.error(`FAIL ${job.kind}/${job.id}: ${error.message}`);
      }
      throw new Error(`Conversion failed for ${failures.length} files`);
    }
    const targetBytes = jobs.reduce((sum, job) => sum + statSync(job.target).size, 0);
    const converted = results.filter((result) => result === 'converted').length;
    console.log(
      `converted=${converted} skipped=${jobs.length - converted} ` +
        `sourceMiB=${(sourceBytes / 1024 / 1024).toFixed(2)} ` +
        `targetMiB=${(targetBytes / 1024 / 1024).toFixed(2)} ` +
        `reduction=${((1 - targetBytes / sourceBytes) * 100).toFixed(1)}%`,
    );
    return;
  }

  console.log(
    `verify jobs=${jobs.length} concurrency=${concurrency} ` +
      `scope=${allFiles ? 'all-files' : 'active-db-only'}`,
  );
  const { results, failures } = await runPool(jobs, probe);
  if (failures.length > 0) {
    for (const { job, error } of failures.slice(0, 20)) {
      console.error(`FAIL ${job.kind}/${job.id}: ${error.message}`);
    }
    throw new Error(`Verification failed for ${failures.length} files`);
  }
  const totalBytes = results.reduce((sum, size) => sum + size, 0);
  console.log(`valid=${results.length} opusMiB=${(totalBytes / 1024 / 1024).toFixed(2)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

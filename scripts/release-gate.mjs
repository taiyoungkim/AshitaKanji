#!/usr/bin/env node
// Release gate (P0/P1) — 출시 차단 조건을 코드로 강제.
// typecheck/test/lint 는 "코드 품질"만 본다. 이 게이트는 "출시 가능 상태"를 본다:
//   - 학습 데이터/아이콘 자산 존재 (없으면 "데이터 없는 앱" 출시 사고)
//   - git repo (branch/commit workflow 전제)
//   - Privacy/Support/Home URL HTTP 200 (Plan 출시 게이트)
//
// 사용: node scripts/release-gate.mjs
//   SKIP_URL_CHECK=1 → URL 점검 건너뜀 (오프라인 로컬 개발용).
// 하나라도 실패 시 exit 1 → release-check 전체 실패.

import { existsSync, statSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const results = [];
const add = (name, ok, detail) => results.push({ name, ok, detail });

// 1) 필수 바이너리 자산 (app.json 참조 — 없으면 EAS 빌드/실행 불가)
const REQUIRED_ASSETS = [
  'assets/jlpt.db', // Track A 검수 데이터 (없으면 빈 단어장)
  'assets/icon.png',
  'assets/splash.png',
  'assets/adaptive-icon.png',
  'assets/tatoeba-authors.txt',
];
for (const rel of REQUIRED_ASSETS) {
  const p = resolve(ROOT, rel);
  let ok = false;
  let detail = '없음';
  if (existsSync(p)) {
    const size = statSync(p).size;
    ok = size > 0;
    detail = ok ? `${size}B` : '빈 파일(0B)';
  }
  add(`asset: ${rel}`, ok, detail);
}

// 1b) Track A DB 내용 검증 — 파일 존재만으로는 출시 데이터 품질을 보장할 수 없음.
{
  const dbPath = resolve(ROOT, 'assets/jlpt.db');
  if (!existsSync(dbPath)) {
    add('jlpt.db word count', false, 'DB 없음');
    add('jlpt.db verified count', false, 'DB 없음');
  } else {
    try {
      const count = (where) =>
        Number(execFileSync('sqlite3', [dbPath, `SELECT COUNT(*) FROM word WHERE ${where};`], {
          encoding: 'utf8',
        }).trim());
      const targets = { N5: 300, N4: 600, N3: 1100, N2: 1700, N1: 2500 };
      const levelBad = Object.entries(targets).filter(([level, target]) =>
        count(`level='${level}' AND deprecated=0`) !== target,
      );
      add(
        'jlpt.db level counts',
        levelBad.length === 0,
        levelBad.length === 0
          ? 'N5=300 N4=600 N3=1100 N2=1700 N1=2500'
          : `불일치: ${levelBad.map(([level, target]) => `${level}!=${target}`).join(', ')}`,
      );
      const verified = count(`qa_status='verified' AND deprecated=0`);
      const nonVerified = count(`qa_status!='verified' AND deprecated=0`);
      add(
        'jlpt.db verified 6200',
        verified === 6200 && nonVerified === 0,
        `verified=${verified}, non_verified=${nonVerified}`,
      );
    } catch (err) {
      add('jlpt.db content check', false, `sqlite3 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

// 2) git repo
add('git repo (.git)', existsSync(resolve(ROOT, '.git')), existsSync(resolve(ROOT, '.git')) ? 'OK' : '없음 (git init 필요)');

// 2b) EAS 제출값 — TBD/빈 값이면 스토어 제출 자동화 불가 (App Store Connect 값 필요).
{
  const easPath = resolve(ROOT, 'eas.json');
  if (!existsSync(easPath)) {
    add('eas.json submit', false, '없음');
  } else {
    try {
      const eas = JSON.parse(readFileSync(easPath, 'utf8'));
      const ios = eas?.submit?.production?.ios ?? {};
      // 채워져야 할 iOS 제출 필드 (android 는 secrets 키파일로 별도 검증).
      const required = ['appleId', 'ascAppId', 'appleTeamId'];
      const bad = required.filter((k) => {
        const v = ios[k];
        return !v || String(v).trim() === '' || /^TBD$/i.test(String(v).trim());
      });
      add(
        'eas.json submit.ios 값',
        bad.length === 0,
        bad.length === 0 ? 'OK' : `미설정/TBD: ${bad.join(', ')}`,
      );
    } catch (err) {
      add('eas.json submit', false, `파싱 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

// 3) Privacy/Support/Home URL HTTP 200
const URLS = [
  'https://taiyoungkim.github.io/AshitaKanji/',
  'https://taiyoungkim.github.io/AshitaKanji/privacy/',
  'https://taiyoungkim.github.io/AshitaKanji/support/',
];
if (process.env.SKIP_URL_CHECK === '1') {
  add('URL HTTP 200', false, 'SKIPPED (SKIP_URL_CHECK=1) — 출시 전 반드시 해제');
} else {
  for (const url of URLS) {
    let ok = false;
    let detail = '';
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      ok = res.status === 200;
      detail = `HTTP ${res.status}`;
    } catch (err) {
      detail = `요청 실패: ${err instanceof Error ? err.message : String(err)}`;
    }
    add(`URL ${url}`, ok, detail);
  }
}

// 출력
const pad = Math.max(...results.map((r) => r.name.length));
let failed = 0;
console.log('\n── Release Gate ──');
for (const r of results) {
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? '✅' : '❌'} ${r.name.padEnd(pad)}  ${r.detail}`);
}
const skipped = process.env.SKIP_URL_CHECK === '1' ? ' (URL 점검 생략됨)' : '';
console.log(`──────────────────\n${failed === 0 ? 'PASS' : `FAIL (${failed}건)`}${skipped}\n`);

process.exit(failed === 0 ? 0 : 1);

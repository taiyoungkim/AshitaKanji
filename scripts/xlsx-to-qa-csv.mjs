#!/usr/bin/env node
// xlsx(QA work, inlineStr) → QA work CSV 변환. 외부 라이브러리 없이 unzip + XML 파싱.
// Track A 한국어 채운 엑셀을 data/track-a/jlpt_qa_work.csv 형식으로 환원 → build-jlpt-db 재빌드용.
//
// 사용: node scripts/xlsx-to-qa-csv.mjs --in <xlsx> --out <csv>
//   가정: 단일 시트(xl/worksheets/sheet1.xml), 1행=헤더, 전부 inlineStr/숫자 셀.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = parseArgs(process.argv.slice(2));
if (!args.in || !args.out) {
  console.error('Usage: node scripts/xlsx-to-qa-csv.mjs --in <xlsx> --out <csv>');
  process.exit(1);
}
const xlsxPath = resolve(args.in);
const outPath = resolve(args.out);
const sheetEntry = args.sheet ?? 'xl/worksheets/sheet1.xml';

const xml = execFileSync('unzip', ['-p', xlsxPath, sheetEntry], {
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
});

const grid = parseSheet(xml);
if (grid.length === 0) {
  console.error('빈 시트');
  process.exit(1);
}

// 헤더 폭에 맞춰 모든 행을 정규화 후 CSV 출력.
const headers = grid[0];
const width = headers.length;
const lines = [headers.map(csvEscape).join(',')];
for (let r = 1; r < grid.length; r++) {
  const row = grid[r];
  // 완전 빈 행 skip.
  if (!row.some((v) => v && v.trim() !== '')) continue;
  const cells = [];
  for (let c = 0; c < width; c++) cells.push(csvEscape(row[c] ?? ''));
  lines.push(cells.join(','));
}
writeFileSync(outPath, `${lines.join('\n')}\n`);
console.log(`✅ ${outPath}  (${lines.length - 1} data rows, ${width} cols)`);

// --- 파서 ---
function parseSheet(text) {
  const rows = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let m;
  while ((m = rowRe.exec(text)) !== null) {
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    const cols = [];
    let cm;
    while ((cm = cellRe.exec(m[1])) !== null) {
      const attrs = cm[1];
      const inner = cm[2] ?? '';
      const refMatch = /\br="([A-Z]+)\d+"/.exec(attrs);
      const colIdx = refMatch ? colToIndex(refMatch[1]) : cols.length;
      const value = extractCellValue(attrs, inner);
      cols[colIdx] = value;
    }
    // 구멍(빈 셀) 채우기.
    for (let i = 0; i < cols.length; i++) if (cols[i] === undefined) cols[i] = '';
    rows.push(cols);
  }
  return rows;
}

function extractCellValue(attrs, inner) {
  const t = /\bt="([^"]+)"/.exec(attrs)?.[1];
  if (t === 'inlineStr') {
    // <is> 안의 모든 <t> 연결 (rich text <r><t> 포함).
    const parts = [];
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let tm;
    while ((tm = tRe.exec(inner)) !== null) parts.push(decodeXml(tm[1]));
    return parts.join('');
  }
  if (t === 'str' || t === 'e') {
    return decodeXml(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? '');
  }
  // 숫자/기본: <v>.
  return decodeXml(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? '');
}

function colToIndex(letters) {
  let n = 0;
  for (let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
  return n - 1;
}

function decodeXml(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
  }
  return out;
}

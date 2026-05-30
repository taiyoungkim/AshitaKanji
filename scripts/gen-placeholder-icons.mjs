#!/usr/bin/env node
// 임시(placeholder) 앱 아이콘 생성기 — 실제 디자인 전 EAS 빌드/release-gate 자산 점검 통과용.
// ⚠ TEMP: 출시 전 반드시 실제 아이콘으로 교체. 외부 라이브러리 없이 zlib 만으로 PNG 인코딩.
//
// 브랜드 색(#0366d6) 바탕 + 흰 원형 마크. 생성:
//   assets/icon.png(1024 불투명), adaptive-icon.png(1024 투명+파란 원), splash.png(1024), favicon.png(64)
// 사용: node scripts/gen-placeholder-icons.mjs

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BLUE = [3, 102, 214];
const WHITE = [255, 255, 255];

// --- PNG 인코딩 (RGBA, 8bit) ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgbaFn) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = rgbaFn(x, y);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = a;
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 중심 원 판정 헬퍼.
function circle(size, radiusRatio) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * radiusRatio;
  return (x, y) => Math.hypot(x - cx, y - cy) <= r;
}

const ROOT = process.cwd();
const ASSETS = resolve(ROOT, 'assets');
mkdirSync(ASSETS, { recursive: true });

const out = (name, buf) => {
  writeFileSync(resolve(ASSETS, name), buf);
  console.log(`✅ assets/${name}  ${buf.length}B`);
};

// icon.png — 불투명 파란 바탕 + 흰 원 (iOS 알파 비권장).
{
  const size = 1024;
  const inCircle = circle(size, 0.3);
  out(
    'icon.png',
    encodePng(size, size, (x, y) =>
      inCircle(x, y) ? [...WHITE, 255] : [...BLUE, 255],
    ),
  );
}

// adaptive-icon.png — 투명 바탕 + 파란 원(안전영역 안). app.json background=#fff.
{
  const size = 1024;
  const inCircle = circle(size, 0.28);
  out(
    'adaptive-icon.png',
    encodePng(size, size, (x, y) =>
      inCircle(x, y) ? [...BLUE, 255] : [0, 0, 0, 0],
    ),
  );
}

// splash.png — 파란 바탕 + 흰 원 (resizeMode contain).
{
  const size = 1024;
  const inCircle = circle(size, 0.18);
  out(
    'splash.png',
    encodePng(size, size, (x, y) =>
      inCircle(x, y) ? [...WHITE, 255] : [...BLUE, 255],
    ),
  );
}

// favicon.png — web.
{
  const size = 64;
  const inCircle = circle(size, 0.3);
  out(
    'favicon.png',
    encodePng(size, size, (x, y) =>
      inCircle(x, y) ? [...WHITE, 255] : [...BLUE, 255],
    ),
  );
}

console.log('\n⚠ TEMP placeholder icons — 출시 전 실제 디자인으로 교체할 것.');

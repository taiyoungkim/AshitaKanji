import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

export const root = path.resolve(import.meta.dirname, '..');
export const manifest = JSON.parse(fs.readFileSync(path.join(root, 'ui/manifest.json'), 'utf8'));

export function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
export function readPng(file) { return PNG.sync.read(fs.readFileSync(file)); }
export function writePng(file, png) { ensureDir(path.dirname(file)); fs.writeFileSync(file, PNG.sync.write(png)); }

export function resize(source, width, height) {
  if (source.width === width && source.height === height) return source;
  const out = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(source.height - 1, Math.floor((y + 0.5) * source.height / height));
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(source.width - 1, Math.floor((x + 0.5) * source.width / width));
      const from = (sy * source.width + sx) * 4;
      const to = (y * width + x) * 4;
      source.data.copy(out.data, to, from, from + 4);
    }
  }
  return out;
}

export function designViewport(source, fixture) {
  const { width, height } = manifest.viewport;
  if (source.width !== width) source = resize(source, width, Math.round(source.height * width / source.width));
  if (source.height <= height) return resize(source, width, height);
  const tabScreens = /^(01|08|09|10|11|12|13|14|16|17)-/.test(fixture);
  if (!tabScreens) {
    const out = new PNG({ width, height });
    source.data.copy(out.data, 0, 0, width * height * 4);
    return out;
  }
  const tabHeight = 88;
  const out = new PNG({ width, height });
  source.data.copy(out.data, 0, 0, width * (height - tabHeight) * 4);
  const from = width * (source.height - tabHeight) * 4;
  source.data.copy(out.data, width * (height - tabHeight) * 4, from, from + width * tabHeight * 4);
  return out;
}

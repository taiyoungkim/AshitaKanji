import fs from 'node:fs';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { ensureDir, manifest, readPng, root, writePng } from './ui-image-lib.mjs';

const platformArg = process.argv.find((value) => value.startsWith('--platform='));
const platforms = platformArg ? [platformArg.split('=')[1]] : ['ios', 'android'];
const threshold = Number(process.env.UI_DIFF_MAX_RATIO ?? '0.035');
let failed = false;
const report = { designCommit: manifest.designCommit, threshold, generatedAt: new Date().toISOString(), results: [] };

for (const platform of platforms) {
  for (const fixture of manifest.fixtures) {
    const baselineFile = path.join(root, 'ui/baseline', platform, `${fixture}.png`);
    const actualFile = path.join(root, 'ui/actual', platform, `${fixture}.png`);
    if (!fs.existsSync(baselineFile) || !fs.existsSync(actualFile)) {
      failed = true;
      report.results.push({ platform, fixture, status: 'missing' });
      continue;
    }
    const baseline = readPng(baselineFile);
    const actual = readPng(actualFile);
    if (baseline.width !== actual.width || baseline.height !== actual.height) {
      failed = true;
      report.results.push({ platform, fixture, status: 'dimension-mismatch', baseline: `${baseline.width}x${baseline.height}`, actual: `${actual.width}x${actual.height}` });
      continue;
    }
    const diff = new PNG({ width: baseline.width, height: baseline.height });
    const overlay = new PNG({ width: baseline.width, height: baseline.height });
    let luminanceError = 0;
    for (let i = 0; i < baseline.data.length; i += 4) {
      for (let channel = 0; channel < 3; channel += 1) overlay.data[i + channel] = Math.round((baseline.data[i + channel] + actual.data[i + channel]) / 2);
      overlay.data[i + 3] = 255;
      const baseY = baseline.data[i] * 0.2126 + baseline.data[i + 1] * 0.7152 + baseline.data[i + 2] * 0.0722;
      const actualY = actual.data[i] * 0.2126 + actual.data[i + 1] * 0.7152 + actual.data[i + 2] * 0.0722;
      luminanceError += Math.abs(baseY - actualY) / 255;
    }
    const mismatched = pixelmatch(baseline.data, actual.data, diff.data, baseline.width, baseline.height, { threshold: 0.15, includeAA: false });
    const pixels = baseline.width * baseline.height;
    const ratio = mismatched / pixels;
    const perceptual = luminanceError / pixels;
    const status = ratio <= threshold ? 'pass' : 'fail';
    if (status === 'fail') failed = true;
    writePng(path.join(root, 'ui/overlay', platform, `${fixture}.png`), overlay);
    writePng(path.join(root, 'ui/diff', platform, `${fixture}.png`), diff);
    report.results.push({ platform, fixture, status, pixelRatio: Number(ratio.toFixed(6)), perceptualLumaMae: Number(perceptual.toFixed(6)) });
    console.log(`${status.toUpperCase()} ${platform}/${fixture} pixel=${(ratio * 100).toFixed(2)}% luma=${(perceptual * 100).toFixed(2)}%`);
  }
}

ensureDir(path.join(root, 'ui/diff'));
fs.writeFileSync(path.join(root, 'ui/diff/report.json'), `${JSON.stringify(report, null, 2)}\n`);
if (failed) process.exitCode = 1;

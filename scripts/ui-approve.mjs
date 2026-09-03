import fs from 'node:fs';
import path from 'node:path';
import { designViewport, ensureDir, manifest, readPng, root, writePng } from './ui-image-lib.mjs';

const fromDesign = process.argv.includes('--from-design');
const platformArg = process.argv.find((value) => value.startsWith('--platform='));
const platforms = platformArg ? [platformArg.split('=')[1]] : ['ios', 'android'];
const baselineRoot = path.join(root, 'ui/baseline');

if (fromDesign) {
  for (const platform of platforms) {
    for (const fixture of manifest.fixtures) {
      const sourceFile = path.join(manifest.designRoot, `${fixture}.png`);
      if (!fs.existsSync(sourceFile)) throw new Error(`Missing design source: ${sourceFile}`);
      writePng(path.join(baselineRoot, platform, `${fixture}.png`), designViewport(readPng(sourceFile), fixture));
    }
  }
  console.log(`Approved ${manifest.fixtures.length} canonical design viewports for ${platforms.join(', ')}`);
} else {
  for (const platform of platforms) {
    const actualDir = path.join(root, 'ui/actual', platform);
    ensureDir(path.join(baselineRoot, platform));
    for (const fixture of manifest.fixtures) {
      const sourceFile = path.join(actualDir, `${fixture}.png`);
      if (!fs.existsSync(sourceFile)) throw new Error(`Missing actual: ${sourceFile}`);
      fs.copyFileSync(sourceFile, path.join(baselineRoot, platform, `${fixture}.png`));
    }
  }
  console.log(`Explicitly approved current actuals for ${platforms.join(', ')}`);
}

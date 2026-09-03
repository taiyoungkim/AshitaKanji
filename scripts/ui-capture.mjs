import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { ensureDir, manifest, readPng, resize, root, writePng } from './ui-image-lib.mjs';

const platformArg = process.argv.find((value) => value.startsWith('--platform='));
const platforms = platformArg ? [platformArg.split('=')[1]] : ['ios', 'android'];
const bundleId = 'com.taiyoungkim.ashitakanji';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', stdio: options.stdio ?? 'pipe' }).trim();

async function captureIos() {
  const udid = process.env.UI_IOS_UDID ?? manifest.ios.udid;
  const container = run('xcrun', ['simctl', 'get_app_container', udid, bundleId, 'data']);
  ensureDir(path.join(root, 'ui/actual/ios'));
  for (const fixture of manifest.fixtures) {
    fs.writeFileSync(path.join(container, 'Documents/ui-capture-fixture.txt'), fixture);
    spawnSync('xcrun', ['simctl', 'terminate', udid, bundleId]);
    run('xcrun', ['simctl', 'launch', udid, bundleId]);
    await sleep(Number(process.env.UI_CAPTURE_WAIT_MS ?? 3500));
    const raw = path.join(root, 'ui/actual/ios', `.${fixture}.raw.png`);
    run('xcrun', ['simctl', 'io', udid, 'screenshot', raw]);
    writePng(path.join(root, 'ui/actual/ios', `${fixture}.png`), resize(readPng(raw), manifest.viewport.width, manifest.viewport.height));
    fs.unlinkSync(raw);
    console.log(`CAPTURE ios/${fixture}`);
  }
}

async function captureAndroid() {
  const adb = process.env.ADB ?? path.join(process.env.HOME, 'Library/Android/sdk/platform-tools/adb');
  run(adb, ['wait-for-device']);
  for (const fixture of manifest.fixtures) {
    run(adb, ['shell', 'am', 'force-stop', bundleId]);
    // Release APKs are not debuggable, so use the app's private deep link
    // instead of adb run-as. The compile-time capture gate still applies.
    run(adb, ['shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', `ashitakanji:///_dev/ui-capture?fixture=${fixture}`, bundleId]);
    await sleep(Number(process.env.UI_CAPTURE_WAIT_MS ?? 3500));
    const result = spawnSync(adb, ['exec-out', 'screencap', '-p'], { encoding: null });
    if (result.status !== 0) throw new Error(result.stderr?.toString() || 'Android screenshot failed');
    const raw = path.join(root, 'ui/actual/android', `.${fixture}.raw.png`);
    fs.mkdirSync(path.dirname(raw), { recursive: true });
    fs.writeFileSync(raw, result.stdout);
    writePng(path.join(root, 'ui/actual/android', `${fixture}.png`), resize(readPng(raw), manifest.viewport.width, manifest.viewport.height));
    fs.unlinkSync(raw);
    console.log(`CAPTURE android/${fixture}`);
  }
}

for (const platform of platforms) {
  if (platform === 'ios') await captureIos();
  else if (platform === 'android') await captureAndroid();
  else throw new Error(`Unsupported platform: ${platform}`);
}

// Metro config — bundle the prebuilt SQLite DB, web WASM, and Android Ogg/Opus audio.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Release bundles include roughly 15,000 static Ogg assets. Multiple Metro
// worker pools can exceed the 16 GB EAS medium-builder limit because each
// worker gets its own Node heap. A single worker is slower but deterministic
// and keeps the production bundle within the free builder's memory budget.
config.maxWorkers = 1;

for (const ext of ['db', 'wasm', 'ogg']) {
  if (!config.resolver.assetExts.includes(ext)) {
    config.resolver.assetExts.push(ext);
  }
}

// Avoid zustand's ESM build using import.meta in unsupported web Hermes transforms.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;

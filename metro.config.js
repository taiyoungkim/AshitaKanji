// Metro config — bundle the prebuilt SQLite DB, web WASM, and Android Ogg/Opus audio.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

for (const ext of ['db', 'wasm', 'ogg']) {
  if (!config.resolver.assetExts.includes(ext)) {
    config.resolver.assetExts.push(ext);
  }
}

// Avoid zustand's ESM build using import.meta in unsupported web Hermes transforms.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;

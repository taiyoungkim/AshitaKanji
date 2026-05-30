// Metro config — bundle the prebuilt SQLite DB and expo-sqlite web WASM assets.
// Default assetExts excludes `db`, so require('../../assets/jlpt.db') in src/db/open.ts
// would fail to bundle and the app would launch with an empty word table.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
for (const ext of ['db', 'wasm']) {
  if (!config.resolver.assetExts.includes(ext)) {
    config.resolver.assetExts.push(ext);
  }
}

// SDK 53 defaults package-exports resolution ON, which pulls zustand's
// ESM build (esm/middleware.mjs) that uses `import.meta` — unsupported by the
// web Hermes transform, causing "Cannot use 'import.meta' outside a module".
// Fall back to CJS ("main") resolution to avoid import.meta in the web bundle.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;

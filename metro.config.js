// Metro config — bundle the prebuilt SQLite DB as an asset.
// Default assetExts excludes `db`, so require('../../assets/jlpt.db') in src/db/open.ts
// would fail to bundle and the app would launch with an empty word table.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
if (!config.resolver.assetExts.includes('db')) {
  config.resolver.assetExts.push('db');
}

// SDK 53 defaults package-exports resolution ON, which pulls zustand's
// ESM build (esm/middleware.mjs) that uses `import.meta` — unsupported by the
// web Hermes transform, causing "Cannot use 'import.meta' outside a module".
// Fall back to CJS ("main") resolution to avoid import.meta in the web bundle.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;

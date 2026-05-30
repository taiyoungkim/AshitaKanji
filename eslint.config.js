// Release gate (P1) — ESLint flat config 기반 expo lint.
// eslint-config-expo: SDK 53 권장 룰셋. tsconfig 경로 별칭(~/*)은 타입체크가 담당.
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.expo/**',
      'android/**',
      'ios/**',
      'scripts/**',
      'site/**',
    ],
  },
];

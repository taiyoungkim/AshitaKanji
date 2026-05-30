// Design Ref: §8 Test Plan — unit tests for pure logic (cardType, FSRS wrapper, services)
// RN 컴포넌트 렌더 테스트는 별도(jest-expo). vitest는 순수 TS 로직만.

import { defineConfig } from 'vitest/config';
// node:url 의 URL 을 명시 import — TS5.8 에서 lib.dom URL 과 충돌 방지.
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});

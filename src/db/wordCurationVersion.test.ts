import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { requiresWordSeedHydration } from './wordCurationVersion';

const OPEN_SOURCE = readFileSync(resolve('src/db/open.ts'), 'utf8');
const BUILD_SOURCE = readFileSync(resolve('scripts/build-jlpt-db.mjs'), 'utf8');

function versionFrom(source: string): string {
  const match = source.match(/WORD_CURATION_VERSION\s*=\s*['"](\d+)['"]/);
  if (!match) throw new Error('WORD_CURATION_VERSION is missing');
  return match[1]!;
}

describe('word seed curation upgrade', () => {
  it('keeps the runtime and bundled seed at curation version 13', () => {
    expect(versionFrom(OPEN_SOURCE)).toBe('13');
    expect(versionFrom(BUILD_SOURCE)).toBe('13');
  });

  it('rehydrates an existing version 12 database from the latest seed', () => {
    expect(requiresWordSeedHydration('12', versionFrom(OPEN_SOURCE))).toBe(true);
  });

  it('does not redundantly rehydrate an already-current database', () => {
    expect(requiresWordSeedHydration('13', versionFrom(OPEN_SOURCE))).toBe(false);
  });
});

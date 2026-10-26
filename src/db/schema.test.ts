import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, migrationsTo } from './schema';

describe('database schema', () => {
  it('includes the supplemental-review marker in schema v7', () => {
    expect(migrationsTo(7).some((sql) => sql.includes('scheduling_applied'))).toBe(true);
  });

  it('adds the cat card draw log and stamp epoch in schema v8', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(8);
    const v8 = migrationsTo(8);
    expect(v8.slice(0, migrationsTo(7).length)).toEqual(migrationsTo(7));
    expect(v8.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS cat_card_draw'))).toBe(true);
    expect(v8.some((sql) => sql.includes("'cat_card_epoch'"))).toBe(true);
  });
});

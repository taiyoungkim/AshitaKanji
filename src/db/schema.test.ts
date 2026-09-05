import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, migrationsTo } from './schema';

describe('database schema', () => {
  it('includes the supplemental-review marker in schema v7', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(7);
    expect(migrationsTo(7).some((sql) => sql.includes('scheduling_applied'))).toBe(true);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(process.cwd(), '..');
const migration = readFileSync(
  resolve(repositoryRoot, 'supabase/migrations/20260822110000_learning_goals_free_text.sql'),
  'utf8',
);

describe('learning goals free-text migration contract', () => {
  it('adds learning_goals when a legacy database does not have the column', () => {
    expect(migration).toMatch(/ADD COLUMN learning_goals TEXT/i);
  });

  it('converts the historical TEXT[] column without discarding legacy goals', () => {
    expect(migration).toMatch(/learning_goals_udt = '_text'/i);
    expect(migration).toMatch(/ALTER COLUMN learning_goals TYPE TEXT/i);
    expect(migration).toMatch(/array_to_string\(learning_goals, ', '\)/i);
  });

  it('guards new writes with the API 1000-character bound', () => {
    expect(migration).toMatch(/users_learning_goals_length_check/i);
    expect(migration).toMatch(/char_length\(learning_goals\) <= 1000/i);
    expect(migration).toMatch(/NOT VALID/i);
  });

  it('is restart-safe for both the column and constraint', () => {
    expect(migration).toMatch(/IF learning_goals_udt IS NULL/i);
    expect(migration).toMatch(/IF NOT EXISTS \([\s\S]*?pg_constraint/i);
  });
});

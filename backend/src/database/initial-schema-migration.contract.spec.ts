import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(process.cwd(), '..');
const migration = readFileSync(
  resolve(repositoryRoot, 'supabase/migrations/001_initial_schema.sql'),
  'utf8',
);

describe('001_initial_schema migration contract', () => {
  it('enables the database capabilities required by the user schema', () => {
    expect(migration).toMatch(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp"/i);
    expect(migration).toMatch(/CREATE EXTENSION IF NOT EXISTS postgis/i);
    expect(migration).toMatch(/CREATE EXTENSION IF NOT EXISTS pg_trgm/i);
  });

  it('owns user lifecycle through auth.users and stores PostGIS coordinates', () => {
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.users/i);
    expect(migration).toMatch(
      /id\s+UUID\s+PRIMARY KEY\s+REFERENCES auth\.users\(id\)\s+ON DELETE CASCADE/i,
    );
    expect(migration).toMatch(/location\s+GEOGRAPHY\(POINT,\s*4326\)/i);
    expect(migration).toMatch(/mock_location\s+GEOGRAPHY\(POINT,\s*4326\)/i);
  });

  it('defines the VIP, economy and learning-state fields with safe defaults', () => {
    expect(migration).toMatch(/is_vip\s+BOOLEAN\s+NOT NULL\s+DEFAULT false/i);
    expect(migration).toMatch(/coins_balance\s+INTEGER\s+NOT NULL\s+DEFAULT 0/i);
    expect(migration).toMatch(/study_streak_days\s+INTEGER\s+NOT NULL\s+DEFAULT 1/i);
    expect(migration).toMatch(/correction_ratio\s+REAL\s+NOT NULL\s+DEFAULT 1\.0/i);
  });

  it('indexes spatial discovery and common user lookup fields', () => {
    expect(migration).toMatch(
      /users_location_idx\s+ON public\.users\s+USING GIST\s*\(location\)/i,
    );
    expect(migration).toMatch(
      /users_mock_location_idx\s+ON public\.users\s+USING GIST\s*\(mock_location\)/i,
    );
    expect(migration).toMatch(
      /users_display_name_trgm_idx\s+ON public\.users\s+USING GIN\s*\(display_name gin_trgm_ops\)/i,
    );
    expect(migration).toMatch(/users_is_vip_idx\s+ON public\.users\s*\(is_vip\)/i);
  });
});

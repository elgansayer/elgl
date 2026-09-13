import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(process.cwd(), '..');
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations');
const migration = readFileSync(
  resolve(migrationsDirectory, '001_initial_schema.sql'),
  'utf8',
);
const rowLevelSecurity = readFileSync(
  resolve(migrationsDirectory, '009_row_level_security.sql'),
  'utf8',
);
const usersRowLevelSecurityHardeningFile =
  '20260807000000_review_rls_virtual_coin_economy.sql';
const usersRowLevelSecurityHardening = readFileSync(
  resolve(migrationsDirectory, usersRowLevelSecurityHardeningFile),
  'utf8',
);
const laterMigrations = readdirSync(migrationsDirectory)
  .filter(
    (file) =>
      file.endsWith('.sql') && file > usersRowLevelSecurityHardeningFile,
  )
  .sort()
  .map((file) => readFileSync(resolve(migrationsDirectory, file), 'utf8'))
  .join('\n');

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

  it('defines language and profile fields used by onboarding and discovery', () => {
    expect(migration).toMatch(
      /native_language\s+VARCHAR\(10\)\s+NOT NULL\s+DEFAULT\s+'en'/i,
    );
    expect(migration).toMatch(
      /target_languages\s+VARCHAR\(10\)\[\]\s+DEFAULT\s+ARRAY\['es'\]/i,
    );
    expect(migration).toMatch(/bio_text\s+TEXT/i);
    expect(migration).toMatch(/avatar_url\s+TEXT/i);
    expect(migration).toMatch(
      /proficiency_level\s+VARCHAR\(2\)\s+CHECK\s*\(proficiency_level IN \('A1', 'A2', 'B1', 'B2', 'C1', 'C2'\)\)/i,
    );
  });

  it('defines the VIP, economy and learning-state fields with safe defaults', () => {
    expect(migration).toMatch(/is_vip\s+BOOLEAN\s+NOT NULL\s+DEFAULT false/i);
    expect(migration).toMatch(
      /vip_tier\s+VARCHAR\(50\)\s+NOT NULL\s+DEFAULT 'free'/i,
    );
    expect(migration).toMatch(
      /coins_balance\s+INTEGER\s+NOT NULL\s+DEFAULT 0/i,
    );
    expect(migration).toMatch(
      /study_streak_days\s+INTEGER\s+NOT NULL\s+DEFAULT 1/i,
    );
    expect(migration).toMatch(
      /correction_ratio\s+REAL\s+NOT NULL\s+DEFAULT 1\.0/i,
    );
    expect(migration).toMatch(
      /is_serious_learner\s+BOOLEAN\s+NOT NULL\s+DEFAULT false/i,
    );
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
    expect(migration).toMatch(
      /users_native_language_idx\s+ON public\.users\s*\(native_language\)/i,
    );
    expect(migration).toMatch(
      /users_is_vip_idx\s+ON public\.users\s*\(is_vip\)/i,
    );
    expect(migration).toMatch(
      /users_is_serious_learner_idx\s+ON public\.users\s*\(is_serious_learner\)/i,
    );
  });

  it('keeps the historical baseline replay-safe and non-destructive', () => {
    const createStatements =
      migration.match(/CREATE (?:EXTENSION|TABLE|INDEX)[\s\S]*?;/gi) ?? [];

    expect(createStatements.length).toBeGreaterThan(0);
    for (const statement of createStatements) {
      expect(statement).toMatch(/IF NOT EXISTS/i);
    }
    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE\s+FROM)\b/i);
  });

  it('is protected by the effective users RLS defence-in-depth boundary', () => {
    expect(rowLevelSecurity).toMatch(
      /ALTER TABLE public\.users ENABLE ROW LEVEL SECURITY/i,
    );
    expect(rowLevelSecurity).toMatch(
      /CREATE POLICY users_select_authenticated ON public\.users\s+FOR SELECT TO authenticated USING \(true\)/i,
    );
    expect(usersRowLevelSecurityHardening).toMatch(
      /CREATE POLICY users_update_own ON public\.users\s+FOR UPDATE TO authenticated\s+USING \(auth\.uid\(\) = id\)/i,
    );
    for (const sensitiveColumn of [
      'coins_balance',
      'is_vip',
      'vip_tier',
      'is_admin',
      'developer_api_key',
    ]) {
      expect(usersRowLevelSecurityHardening).toMatch(
        new RegExp(`${sensitiveColumn}\\s+IS NOT DISTINCT FROM`, 'i'),
      );
    }
    expect(laterMigrations).not.toMatch(
      /ALTER TABLE public\.users DISABLE ROW LEVEL SECURITY/i,
    );
    expect(laterMigrations).not.toMatch(
      /DROP POLICY(?: IF EXISTS)? users_update_own ON public\.users/i,
    );
  });
});

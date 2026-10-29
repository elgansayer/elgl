import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20261029000000_create_language_islands.sql',
);

describe('language islands persistence migration (#9464)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf-8');

  it('creates the island and membership tables used by the API', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.language_islands/);
    expect(sql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.language_island_members/,
    );
    expect(sql).toMatch(/PRIMARY KEY \(island_id, user_id\)/);
    expect(sql).toMatch(
      /REFERENCES public\.language_islands\(id\) ON DELETE CASCADE/,
    );
  });

  it('supports the service list, host, language, and membership lookups', () => {
    expect(sql).toMatch(/language_islands_active_created_idx/);
    expect(sql).toMatch(/language_islands_language_pair_idx/);
    expect(sql).toMatch(/language_islands_host_idx/);
    expect(sql).toMatch(/language_island_members_user_idx/);
  });

  it('keeps writes behind the backend service-role boundary', () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.language_islands ENABLE ROW LEVEL SECURITY/,
    );
    expect(sql).toMatch(
      /ALTER TABLE public\.language_island_members ENABLE ROW LEVEL SECURITY/,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON public\.language_islands FROM anon, authenticated/,
    );
    expect(sql).toMatch(
      /GRANT ALL ON public\.language_islands TO service_role/,
    );
  });
});

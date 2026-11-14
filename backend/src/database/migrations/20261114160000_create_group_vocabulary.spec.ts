import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20261114160000_create_group_vocabulary.sql',
);

describe('group vocabulary migration (#9155, #9167)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf-8');

  it('creates the shared vocabulary table with bounded fields', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.group_vocabulary/);
    expect(sql).toMatch(/term VARCHAR\(120\) NOT NULL/);
    expect(sql).toMatch(/translation VARCHAR\(240\) NOT NULL/);
    expect(sql).toMatch(
      /CONSTRAINT group_vocabulary_unique UNIQUE \(group_id, language, term\)/,
    );
  });

  it('keeps the bank inside its group and removes it with the group', () => {
    expect(sql).toMatch(
      /FOREIGN KEY \(group_id\) REFERENCES public\.groups\(id\) ON DELETE CASCADE/,
    );
    expect(sql).toMatch(
      /created_by UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/,
    );
  });

  it('indexes the list and language lookups', () => {
    expect(sql).toMatch(/group_vocabulary_group_created_idx/);
    expect(sql).toMatch(/group_vocabulary_group_language_idx/);
  });

  it('is service-role only', () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.group_vocabulary ENABLE ROW LEVEL SECURITY/,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON public\.group_vocabulary FROM anon, authenticated/,
    );
    expect(sql).toMatch(
      /GRANT ALL ON public\.group_vocabulary TO service_role/,
    );
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20261114123000_create_interests_resource_library_status_views.sql',
);

describe('missing API tables persistence migration (#9841)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf-8');

  it.each([
    'interests',
    'interest_vocabulary',
    'user_interests',
    'resource_library',
    'status_views',
  ])('creates public.%s used by a mounted API module', (table) => {
    expect(sql).toMatch(
      new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} `),
    );
    expect(sql).toMatch(
      new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`),
    );
    expect(sql).toMatch(
      new RegExp(`REVOKE ALL ON public\\.${table} FROM anon, authenticated`),
    );
    expect(sql).toMatch(
      new RegExp(`GRANT ALL ON public\\.${table} TO service_role`),
    );
  });

  it('keeps user-owned rows cascading with account deletion', () => {
    expect(sql).toMatch(
      /user_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/,
    );
    expect(sql).toMatch(
      /created_by UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/,
    );
    expect(sql).toMatch(
      /viewer_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/,
    );
    expect(sql).toMatch(
      /status_owner_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/,
    );
  });

  it('converges the partial compatibility tables with the API columns', () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.user_interests\s+ADD COLUMN IF NOT EXISTS created_at/,
    );
    expect(sql).toMatch(
      /ALTER TABLE public\.interest_vocabulary\s+ADD COLUMN IF NOT EXISTS interest_tag/,
    );
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS language VARCHAR\(16\)/);
    expect(sql).toMatch(/ALTER COLUMN canonical_tag DROP NOT NULL/);
  });

  it('indexes the service query shapes', () => {
    expect(sql).toMatch(/interest_vocabulary_language_tag_idx/);
    expect(sql).toMatch(/interest_vocabulary_tag_language_word_idx/);
    expect(sql).toMatch(/user_interests_user_idx/);
    expect(sql).toMatch(/resource_library_creator_created_idx/);
    expect(sql).toMatch(/resource_library_topic_idx/);
    expect(sql).toMatch(/status_views_owner_status_created_idx/);
    expect(sql).toMatch(/status_views_viewer_idx/);
  });

  it('keeps resource library timestamps maintained by the shared trigger', () => {
    expect(sql).toMatch(
      /BEFORE UPDATE ON public\.resource_library[\s\S]*EXECUTE FUNCTION public\.set_updated_at\(\)/,
    );
  });
});

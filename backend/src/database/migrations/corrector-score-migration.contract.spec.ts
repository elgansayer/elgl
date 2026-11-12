import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(__dirname, '../../../..');
const migration = readFileSync(
  resolve(
    repositoryRoot,
    'supabase/migrations/20261108090000_create_corrector_ratings.sql',
  ),
  'utf8',
);

describe('corrector score migration contract', () => {
  it('creates retry-safe rating persistence with bounded score values', () => {
    expect(migration).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.corrector_ratings/i,
    );
    expect(migration).toMatch(/UNIQUE \(rater_id, rated_user_id\)/i);
    expect(migration).toMatch(/CHECK \(score BETWEEN 1 AND 5\)/i);
    expect(migration).toMatch(/CHECK \(rater_id <> rated_user_id\)/i);
    expect(migration).toMatch(/ON DELETE CASCADE/gi);
    expect(migration).toMatch(
      /CREATE INDEX IF NOT EXISTS corrector_ratings_rated_user_idx/i,
    );
  });

  it('keeps individual ratings behind the service-role API boundary', () => {
    expect(migration).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(migration).toMatch(
      /REVOKE ALL ON TABLE public\.corrector_ratings FROM PUBLIC, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.corrector_ratings TO service_role/i,
    );
  });

  it('aggregates one indexed user score without exposing rating rows', () => {
    expect(migration).toMatch(
      /FUNCTION public\.get_corrector_score\(p_user_id UUID\)/i,
    );
    expect(migration).toMatch(/round\(avg\(cr\.score\)::numeric, 1\)/i);
    expect(migration).toMatch(/WHERE cr\.rated_user_id = p_user_id/i);
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.get_corrector_score\(UUID\)[\s\S]*FROM PUBLIC, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_corrector_score\(UUID\) TO service_role/i,
    );
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('20260825080500_harden_moment_correction_votes', () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      '../supabase/migrations/20260825080500_harden_moment_correction_votes.sql',
    ),
    'utf8',
  );

  it('keeps correction vote toggling inside one database transaction', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.rate_moment_correction');
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain("IF p_vote NOT IN ('up', 'down')");
    expect(migration).toContain('IF v_comment.correction_payload IS NULL');
    expect(migration).toContain('IF v_comment.user_id = p_user_id');
  });

  it('makes the mutation service-role only', () => {
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('TO service_role');
    expect(migration).toContain(
      'REVOKE SELECT, INSERT, UPDATE, DELETE ON public.moment_comment_votes FROM anon, authenticated',
    );
  });

  it('retains correction-only RLS as defence in depth', () => {
    expect(migration).toContain('Users can view own correction votes');
    expect(migration).toContain('mc.correction_payload IS NOT NULL');
    expect(migration).toContain('mc.user_id <> auth.uid()');
  });
});

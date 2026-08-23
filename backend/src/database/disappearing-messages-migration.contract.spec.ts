import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('disappearing messages migration contract', () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      '../supabase/migrations/20260823050000_disappearing_messages.sql',
    ),
    'utf8',
  );

  it('adds an indexed absolute expiry without rewriting historical rows', () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ/i);
    expect(migration).toMatch(/chat_messages_expires_at_idx/i);
    expect(migration).toMatch(/WHERE expires_at IS NOT NULL/i);
  });

  it('derives supported expiries from the persisted sender preference', () => {
    expect(migration).toMatch(/chat_preferences ->> 'disappearingMessagesTtl'/);
    expect(migration).toMatch(/WHEN '24h' THEN base_time \+ INTERVAL '24 hours'/);
    expect(migration).toMatch(/WHEN '7d' THEN base_time \+ INTERVAL '7 days'/);
    expect(migration).toMatch(/WHEN '90d' THEN base_time \+ INTERVAL '90 days'/);
    expect(migration).toMatch(/ELSE NULL/);
    expect(migration).toMatch(/BEFORE INSERT ON public\.chat_messages/i);
  });

  it('purges expired content in bounded concurrency-safe batches', () => {
    expect(migration).toMatch(/purge_expired_chat_messages\(p_limit INTEGER DEFAULT 500\)/);
    expect(migration).toMatch(/LEAST\(GREATEST\(COALESCE\(p_limit, 500\), 1\), 1000\)/);
    expect(migration).toMatch(/expires_at <= now\(\)/);
    expect(migration).toMatch(/FOR UPDATE SKIP LOCKED/);
    expect(migration).toMatch(/LIMIT safe_limit/);
    expect(migration).toMatch(/DELETE FROM public\.favourites/);
    expect(migration).toMatch(/DELETE FROM public\.chat_messages/);
  });

  it('keeps retention helpers backend-only', () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.purge_expired_chat_messages\(INTEGER\) FROM authenticated/i,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.purge_expired_chat_messages\(INTEGER\) TO service_role/i,
    );
  });
});

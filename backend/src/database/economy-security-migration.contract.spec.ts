import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(process.cwd(), '..');
const migration = readFileSync(
  resolve(
    repositoryRoot,
    'supabase/migrations/20260907050000_harden_economy_randomness_and_gift_attribution.sql',
  ),
  'utf8',
);

describe('economy security migration contract', () => {
  it('accepts only a bounded application-generated check-in reward', () => {
    expect(migration).toMatch(
      /claim_daily_checkin\s*\(\s*p_user_id UUID,\s*p_reward INTEGER/i,
    );
    expect(migration).toMatch(/p_reward < 5 OR p_reward > 10/i);
    expect(migration).not.toMatch(/\brandom\s*\(/i);
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.claim_daily_checkin\(UUID\) FROM service_role/i,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.claim_daily_checkin\(UUID, INTEGER\)[\s\S]*TO service_role/i,
    );
  });

  it('preserves claim locking, idempotency, and ledger writes', () => {
    expect(migration).toMatch(/WHERE id = p_user_id[\s\S]*FOR UPDATE/i);
    expect(migration).toMatch(/FROM public\.daily_checkins/i);
    expect(migration).toMatch(/INSERT INTO public\.coin_transactions/i);
    expect(migration).toMatch(/RETURN QUERY SELECT TRUE, p_reward, v_balance/i);
  });

  it('enforces room-host gift attribution in the transaction', () => {
    expect(migration).toMatch(
      /NEW\.room_id IS NOT NULL[\s\S]*id = NEW\.room_id[\s\S]*host_id = NEW\.receiver_id/i,
    );
    expect(migration).toMatch(
      /BEFORE INSERT OR UPDATE OF room_id, receiver_id[\s\S]*ON public\.gift_transactions/i,
    );
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20261114150000_atomic_coin_purchase_settlement.sql',
);

describe('atomic coin purchase settlement migration (#9507, #9497)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf-8');

  it('records the purchase and credits the balance in one function', () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.fulfil_coin_purchase\(/,
    );
    expect(sql).toMatch(/INSERT INTO public\.coin_purchases/);
    expect(sql).toMatch(/ON CONFLICT DO NOTHING/);
    expect(sql).toMatch(
      /UPDATE public\.users\s+SET coins_balance = coins_balance \+ p_coins_added/,
    );
    expect(sql).toMatch(/RETURNING coins_balance INTO v_balance/);
  });

  it('uses row locking semantics instead of a read-modify-write balance update', () => {
    expect(sql).not.toMatch(/SELECT coins_balance/);
    expect(sql).toMatch(/coins_balance = coins_balance \+ v_coins/);
  });

  it('reports duplicates without crediting twice', () => {
    expect(sql).toMatch(/RETURN jsonb_build_object\('status', 'duplicate'\)/);
  });

  it('finalises a pending web purchase atomically', () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.complete_pending_coin_purchase\(/,
    );
    expect(sql).toMatch(/status = 'completed'/);
    expect(sql).toMatch(/AND status = 'pending'/);
    expect(sql).toMatch(/RETURN jsonb_build_object\('status', 'not_pending'\)/);
  });

  it('restricts execution to the service role', () => {
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.fulfil_coin_purchase\([^)]*\) FROM PUBLIC, anon, authenticated/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.fulfil_coin_purchase\([^)]*\) TO service_role/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.complete_pending_coin_purchase\([^)]*\) TO service_role/,
    );
  });
});

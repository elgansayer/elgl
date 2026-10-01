import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(process.cwd(), '..');
const migration = readFileSync(
  resolve(
    repositoryRoot,
    'supabase/migrations/20260901211500_host_dashboard_earnings.sql',
  ),
  'utf8',
);

describe('host dashboard earnings migration contract', () => {
  it('aggregates only gifts received by the room host', () => {
    expect(migration).toMatch(
      /SUM\(gt\.coins_spent\)[\s\S]*gt\.room_id\s*=\s*ar\.id/i,
    );
    expect(migration).toMatch(/gt\.receiver_id\s*=\s*ar\.host_id/i);
    expect(migration).toMatch(/ar\.id\s*=\s*p_room_id/i);
    expect(migration).toMatch(/ar\.host_id\s*=\s*p_host_id/i);
  });

  it('indexes the aggregate lookup', () => {
    expect(migration).toMatch(
      /ON public\.gift_transactions\s*\(room_id,\s*receiver_id\)/i,
    );
  });

  it('keeps the database function backend-only', () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.get_host_dashboard_earnings\(UUID, UUID\)[\s\S]*FROM PUBLIC, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_host_dashboard_earnings\(UUID, UUID\)[\s\S]*TO service_role/i,
    );
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20260825033000_admin_network_rate_limit_controls.sql',
);

function loadMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf-8');
}

describe('admin network emergency throttle migration (#3613)', () => {
  let sql: string;

  beforeAll(() => {
    sql = loadMigration();
  });

  it('creates bounded, expiring and idempotent network controls', () => {
    expect(sql).toMatch(
      /create table if not exists public\.admin_network_rate_limits/i,
    );
    expect(sql).toMatch(/max_requests between 1 and 300/i);
    expect(sql).toMatch(/window_seconds between 10 and 3600/i);
    expect(sql).toMatch(/expires_at > created_at/i);
    expect(sql).toMatch(/unique \(created_by, idempotency_key\)/i);
  });

  it('supports only the established request scopes', () => {
    expect(sql).toMatch(/scope in \('all', 'auth', 'write'\)/i);
    expect(sql).toMatch(/r\.scope = 'all' or r\.scope = p_scope/i);
  });

  it('selects the strictest active matching policy with bounded indexed lookup', () => {
    expect(sql).toMatch(/r\.network >>= p_ip/i);
    expect(sql).toMatch(/r\.revoked_at is null/i);
    expect(sql).toMatch(/r\.expires_at > now\(\)/i);
    expect(sql).toMatch(
      /r\.max_requests::numeric \/ r\.window_seconds::numeric/i,
    );
    expect(sql).toMatch(/limit 1/i);
    expect(sql).toMatch(/idx_admin_network_rate_limits_active/i);
    expect(sql).toMatch(
      /idx_admin_network_rate_limits_network[\s\S]*using gist \(network inet_ops\)/i,
    );
  });

  it('keeps direct browser access closed and the lookup RPC service-role only', () => {
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(
      /revoke all on public\.admin_network_rate_limits from anon, authenticated/i,
    );
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/set search_path = public, pg_temp/i);
    expect(sql).toMatch(
      /revoke all on function public\.admin_network_rate_limit_for_ip\(inet, text\)[\s\S]*from public, anon, authenticated/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.admin_network_rate_limit_for_ip\(inet, text\)[\s\S]*to service_role/i,
    );
  });

  it('extends the existing 180-day network-control retention job', () => {
    expect(sql).toMatch(
      /create or replace function public\.prune_admin_network_controls\(\)/i,
    );
    expect(sql).toMatch(/delete from public\.admin_network_rate_limits/i);
    expect(sql).toMatch(/interval '180 days'/i);
  });

  it('never creates a raw IP persistence column', () => {
    expect(sql).not.toMatch(/\bip_address\b/i);
    expect(sql).not.toMatch(/\braw_ip\b/i);
  });
});

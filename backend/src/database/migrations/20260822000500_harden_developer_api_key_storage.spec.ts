import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20260822000500_harden_developer_api_key_storage.sql',
);

function loadMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf-8');
}

describe('Developer Tier API key storage migration (#1003)', () => {
  let sql: string;

  beforeAll(() => {
    sql = loadMigration();
  });

  it('documents the issue and one-time-secret compatibility contract', () => {
    expect(sql).toMatch(/#1003/);
    expect(sql).toMatch(/one-time issuance response/i);
    expect(sql).toMatch(/mixed-version/i);
  });

  it('uses pgcrypto and persists only a SHA-256 verification digest', () => {
    expect(sql).toMatch(/CREATE EXTENSION IF NOT EXISTS pgcrypto/i);
    expect(sql).toMatch(/developer_api_key_hash TEXT NULL/i);
    expect(sql).toMatch(/encode\(digest\(raw_key, 'sha256'\), 'hex'\)/i);
  });

  it('backfills existing raw ht_dev credentials before enabling the trigger', () => {
    const backfill = sql.indexOf('UPDATE public.users');
    const trigger = sql.indexOf('CREATE TRIGGER protect_developer_api_key_trigger');

    expect(backfill).toBeGreaterThan(-1);
    expect(trigger).toBeGreaterThan(backfill);
    expect(sql).toMatch(/WHERE developer_api_key ~ '\^ht_dev_\[0-9a-fA-F\]\{32\}\$'/);
    expect(sql).toMatch(/developer_api_key = left\(developer_api_key, 15\) \|\| '…' \|\| right\(developer_api_key, 4\)/);
  });

  it('redacts every newly issued raw key before the users row is stored', () => {
    expect(sql).toMatch(/raw_key := NEW\.developer_api_key/);
    expect(sql).toMatch(/NEW\.developer_api_key_prefix := left\(raw_key, 15\)/);
    expect(sql).toMatch(/NEW\.developer_api_key_last_four := right\(raw_key, 4\)/);
    expect(sql).toMatch(/NEW\.developer_api_key := NEW\.developer_api_key_prefix \|\| '…' \|\| NEW\.developer_api_key_last_four/);
  });

  it('rejects malformed credentials rather than storing arbitrary caller input', () => {
    expect(sql).toMatch(/NEW\.developer_api_key !~ '\^ht_dev_\[0-9a-fA-F\]\{32\}\$'/);
    expect(sql).toMatch(/Invalid developer API key format/);
    expect(sql).toMatch(/ERRCODE = '22023'/);
  });

  it('prevents anon and authenticated browser roles from changing server-managed credentials', () => {
    expect(sql).toMatch(/request_role IN \('anon', 'authenticated'\)/);
    expect(sql).toMatch(/Developer API credentials are server-managed/);
    expect(sql).toMatch(/ERRCODE = '42501'/);
  });

  it('prevents direct tampering with derived key metadata', () => {
    expect(sql).toMatch(/Developer API key metadata is derived and cannot be changed directly/);
    expect(sql).toMatch(/NEW\.developer_api_key_hash IS DISTINCT FROM OLD\.developer_api_key_hash/);
    expect(sql).toMatch(/NEW\.developer_api_key_created_at IS DISTINCT FROM OLD\.developer_api_key_created_at/);
  });

  it('supports explicit trusted revocation by clearing all credential material', () => {
    expect(sql).toMatch(/IF NEW\.developer_api_key IS NULL OR btrim\(NEW\.developer_api_key\) = '' THEN/);
    expect(sql).toMatch(/NEW\.developer_api_key_hash := NULL/);
    expect(sql).toMatch(/NEW\.developer_api_key_prefix := NULL/);
    expect(sql).toMatch(/NEW\.developer_api_key_last_four := NULL/);
    expect(sql).toMatch(/NEW\.developer_api_key_created_at := NULL/);
  });

  it('provides an indexed, unique digest lookup without indexing plaintext', () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS users_developer_api_key_hash_uidx/);
    expect(sql).toMatch(/ON public\.users \(developer_api_key_hash\)/);
    expect(sql).not.toMatch(/CREATE (?:UNIQUE )?INDEX[^;]*\(developer_api_key\)/i);
  });

  it('is safe to replay', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS developer_api_key_hash/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.protect_developer_api_key/);
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS protect_developer_api_key_trigger/);
  });

  it('does not introduce logging or telemetry that could expose credentials', () => {
    expect(sql).not.toMatch(/RAISE\s+(?:LOG|NOTICE|INFO|WARNING)/i);
    expect(sql).not.toMatch(/developer_diagnostic_logs/i);
  });
});

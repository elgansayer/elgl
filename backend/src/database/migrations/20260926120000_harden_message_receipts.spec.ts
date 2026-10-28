import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    '..',
    'supabase',
    'migrations',
    '20260926120000_harden_message_receipts.sql',
  ),
  'utf8',
);

const executableSql = migration
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

describe('harden message receipts migration', () => {
  it('makes the receipts table service-role-only so direct clients cannot read or forge who read what', () => {
    expect(executableSql).toContain(
      'ALTER TABLE public.message_receipts ENABLE ROW LEVEL SECURITY;',
    );
    expect(executableSql).toContain(
      'REVOKE ALL ON TABLE public.message_receipts FROM PUBLIC, anon, authenticated;',
    );
    expect(executableSql).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.message_receipts TO service_role;',
    );
  });

  it('does not open the table through a policy', () => {
    expect(executableSql).not.toMatch(/CREATE\s+POLICY/i);
    expect(executableSql).not.toMatch(/TO\s+(anon|authenticated)\s*;/i);
  });

  it('requires a read time whenever a receipt records a read', () => {
    expect(executableSql).toMatch(
      /ADD CONSTRAINT message_receipts_read_at_check\s+CHECK \(status <> 'read' OR read_at IS NOT NULL\) NOT VALID/,
    );
    expect(executableSql).not.toContain(
      'VALIDATE CONSTRAINT message_receipts_read_at_check',
    );
  });

  it('leaves the generated Supabase types baseline untouched', () => {
    // CI compares types generated from a clean replay with
    // supabase/database-types.snapshot.json, so this migration must stay limited
    // to privileges and a constraint.
    expect(executableSql).not.toMatch(/CREATE\s+(TABLE|INDEX|TYPE|VIEW)/i);
    expect(executableSql).not.toMatch(/ADD\s+COLUMN/i);
    expect(executableSql).not.toMatch(/ALTER\s+COLUMN/i);
    expect(executableSql).not.toMatch(/COMMENT\s+ON/i);
  });

  it('is expand-only, retry-safe and compatible with unknown legacy rows', () => {
    expect(executableSql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(executableSql).not.toMatch(/TRUNCATE/i);
    expect(executableSql).not.toMatch(/DELETE\s+FROM/i);
    expect(executableSql).toContain(
      'DROP CONSTRAINT IF EXISTS message_receipts_read_at_check',
    );
  });
});

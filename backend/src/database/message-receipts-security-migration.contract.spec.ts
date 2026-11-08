import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    '..',
    'supabase/migrations/20261108120000_message_receipts_security.sql',
  ),
  'utf8',
);

describe('message receipts security migration', () => {
  it('limits authenticated reads to current room members', () => {
    const selectPolicy = migration.match(
      /CREATE POLICY message_receipts_select_member[\s\S]*?;\n/i,
    )?.[0];

    expect(selectPolicy).toBeDefined();
    expect(selectPolicy).toMatch(/FOR SELECT TO authenticated/i);
    expect(selectPolicy).toMatch(/member\.user_id = auth\.uid\(\)/i);
  });

  it('keeps receipt mutations behind the service-role API boundary', () => {
    expect(migration).toMatch(
      /REVOKE INSERT, UPDATE, DELETE ON public\.message_receipts[\s\S]*FROM anon, authenticated/i,
    );
    expect(migration).not.toMatch(
      /CREATE POLICY message_receipts_(?:insert|update)_/i,
    );
  });
});

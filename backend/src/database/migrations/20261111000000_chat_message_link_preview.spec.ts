import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20261111000000_chat_message_link_preview.sql',
);

/** The migration without comments, so assertions only see executable SQL. */
function executableSql(source: string): string {
  return source.replace(/--.*$/gm, '');
}

describe('Chat message link preview migration (#1678)', () => {
  let source: string;
  let sql: string;

  beforeAll(() => {
    source = readFileSync(MIGRATION_PATH, 'utf-8');
    sql = executableSql(source);
  });

  it('adds one nullable JSONB column idempotently, so there is no rewrite or backfill', () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.chat_messages\s+ADD COLUMN IF NOT EXISTS link_preview JSONB;/,
    );
    expect(sql).not.toMatch(/link_preview JSONB\s+(NOT NULL|DEFAULT)/i);
  });

  it('creates the shape constraint once so the migration can be retried', () => {
    expect(sql).toMatch(
      /IF NOT EXISTS \(\s*SELECT 1\s+FROM pg_constraint\s+WHERE conname = 'chat_messages_link_preview_shape'\s+AND conrelid = 'public\.chat_messages'::regclass\s*\) THEN/,
    );
  });

  it('only accepts a bounded object that carries a destination url', () => {
    expect(sql).toMatch(/link_preview IS NULL\s+OR \(/);
    expect(sql).toMatch(/jsonb_typeof\(link_preview\) = 'object'/);
    expect(sql).toMatch(/octet_length\(link_preview::text\) <= 16384/);
  });

  it('rejects a preview without a url instead of letting NULL pass the check', () => {
    // A bare jsonb_typeof(link_preview -> 'url') = 'string' is NULL when the key
    // is missing, and a CHECK constraint treats NULL as satisfied.
    expect(sql).toMatch(
      /COALESCE\(jsonb_typeof\(link_preview -> 'url'\), ''\) = 'string'/,
    );
    expect(sql).not.toMatch(
      /(?<!COALESCE\()jsonb_typeof\(link_preview -> 'url'\) = 'string'/,
    );
  });

  it('keeps plaintext previews out of end-to-end encrypted messages', () => {
    expect(sql).toMatch(/NOT is_encrypted/);
  });

  it('adds the constraint NOT VALID and never validates it, so the hot table is not scanned under lock', () => {
    expect(sql).toMatch(/\)\s+NOT VALID;/);
    expect(sql).not.toMatch(/VALIDATE CONSTRAINT/i);
  });

  it('is additive: it drops, rewrites and rebuilds nothing', () => {
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|CONSTRAINT)/i);
    expect(sql).not.toMatch(/UPDATE\s+public\.chat_messages/i);
    expect(sql).not.toMatch(/CREATE\s+(UNIQUE\s+)?INDEX/i);
  });

  it('documents the issue, the stored shape, retention and rollback', () => {
    expect(source).toMatch(/#1678/);
    expect(source).toMatch(/"siteName": text/);
    expect(source).toMatch(/Retention and deletion/);
    expect(source).toMatch(/Rollback/);
    expect(sql).toMatch(
      /COMMENT ON COLUMN public\.chat_messages\.link_preview IS/,
    );
  });

  it('contains no em dash', () => {
    expect(source).not.toContain(String.fromCharCode(0x2014));
  });
});

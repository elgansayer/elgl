import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(process.cwd(), '..');
const migrationDirectory = resolve(repositoryRoot, 'supabase/migrations');
const migrationFile = '20261029120000_chat_messages_link_preview.sql';
const migration = readFileSync(
  resolve(migrationDirectory, migrationFile),
  'utf8',
);
// The header documents rollout and retention, so statements are asserted on
// the SQL with comments removed.
const statements = migration.replace(/--.*$/gm, '');

describe('chat message link preview migration contract', () => {
  it('adds a nullable JSONB column idempotently without rewriting rows', () => {
    expect(statements).toMatch(
      /ALTER TABLE public\.chat_messages\s+ADD COLUMN IF NOT EXISTS link_preview JSONB\s*;/i,
    );
    // A default or NOT NULL would rewrite or reject every existing message.
    expect(statements).not.toMatch(
      /link_preview\s+JSONB\s+(NOT NULL|DEFAULT)/i,
    );
    expect(statements).not.toMatch(/\b(UPDATE|DELETE|TRUNCATE)\b/i);
    expect(statements).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
  });

  it('is the only migration that defines the column', () => {
    const definitions = readdirSync(migrationDirectory)
      .filter((file) => file.endsWith('.sql'))
      .filter((file) =>
        /ADD COLUMN IF NOT EXISTS link_preview\b/i.test(
          readFileSync(resolve(migrationDirectory, file), 'utf8'),
        ),
      );

    expect(definitions).toEqual([migrationFile]);
  });

  it('bounds the stored value with a re-runnable, lock-friendly check', () => {
    // Guarded so the migration can run twice.
    expect(statements).toMatch(
      /IF NOT EXISTS \(\s*SELECT 1\s+FROM pg_constraint\s+WHERE conrelid = 'public\.chat_messages'::regclass\s+AND conname = 'chat_messages_link_preview_check'\s*\)/i,
    );
    expect(statements).toMatch(/jsonb_typeof\(link_preview\) = 'object'/);
    expect(statements).toMatch(/octet_length\(link_preview::text\) <= 16384/);
    // NOT VALID then VALIDATE avoids a long exclusive lock on a large table.
    expect(statements).toMatch(/\)\s*NOT VALID;/);
    expect(statements).toMatch(
      /ALTER TABLE public\.chat_messages\s+VALIDATE CONSTRAINT chat_messages_link_preview_check;/,
    );
    // A NULL preview, which is every existing and most new rows, always passes.
    expect(statements).toMatch(/link_preview IS NULL\s+OR/);
  });

  it('prevents authenticated direct inserts from forging backend previews', () => {
    expect(statements).toMatch(
      /DROP POLICY IF EXISTS chat_messages_link_preview_backend_only\s+ON public\.chat_messages;/i,
    );
    expect(statements).toMatch(
      /CREATE POLICY chat_messages_link_preview_backend_only\s+ON public\.chat_messages\s+AS RESTRICTIVE\s+FOR INSERT\s+TO authenticated\s+WITH CHECK \(link_preview IS NULL\);/i,
    );
    // The service role is intentionally outside this policy and writes the
    // preview only after the backend scraper has validated and sanitised it.
    expect(statements).not.toMatch(
      /chat_messages_link_preview_backend_only[\s\S]*?TO\s+[^;]*service_role/i,
    );
  });

  it('allows exactly the preview size the application caches and writes', () => {
    const service = readFileSync(
      resolve(
        repositoryRoot,
        'backend/src/link-preview/link-preview.service.ts',
      ),
      'utf8',
    );
    const applicationBound = /MAX_CACHE_ENTRY_BYTES = ([\d_]+);/.exec(service);
    const databaseBound = /octet_length\(link_preview::text\) <= (\d+)/.exec(
      statements,
    );

    expect(applicationBound).not.toBeNull();
    expect(databaseBound).not.toBeNull();
    expect(Number(databaseBound?.[1])).toBe(
      Number(applicationBound?.[1].replace(/_/g, '')),
    );
  });

  it('documents the column, its retention and the rollout order', () => {
    expect(migration).toMatch(
      /COMMENT ON COLUMN public\.chat_messages\.link_preview IS/,
    );
    expect(migration).toMatch(
      /Retention: the preview lives and dies with its message row/,
    );
    expect(migration).toMatch(
      /Rollout: additive and safe with mixed application versions/,
    );
    expect(migration).toMatch(/Roll back by reverting the application/);
  });

  it('has a unique timestamp id that replays after the previous latest migration', () => {
    const files = readdirSync(migrationDirectory)
      .filter((file) => file.endsWith('.sql'))
      .sort();
    const id = migrationFile.split('_')[0];

    expect(files.filter((file) => file.startsWith(`${id}_`))).toEqual([
      migrationFile,
    ]);
    // Migrations replay in lexical order.
    expect(files.indexOf(migrationFile)).toBeGreaterThan(
      files.indexOf('20261023180000_add_serious_learner_mode.sql'),
    );
  });
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const migrationUrl = new URL('../supabase/migrations/002_trust_and_safety.sql', import.meta.url);
const rlsUrl = new URL('../supabase/migrations/009_row_level_security.sql', import.meta.url);

const migration = await readFile(migrationUrl, 'utf8');
const rlsMigration = await readFile(rlsUrl, 'utf8');

function assertSql(sql, pattern, message) {
  assert.match(sql.replace(/\s+/g, ' '), pattern, message);
}

test('002_trust_and_safety creates the required trust and safety tables', () => {
  for (const table of ['profile_visits', 'blocks', 'reports']) {
    assertSql(
      migration,
      new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\(`, 'i'),
      `expected 002_trust_and_safety.sql to create public.${table}`,
    );
  }
});

test('profile visits preserve user ownership and bounded lookup indexes', () => {
  assertSql(
    migration,
    /visitor_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/i,
    'visitor rows must be deleted with the visiting account',
  );
  assertSql(
    migration,
    /viewed_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/i,
    'visit rows must be deleted with the viewed account',
  );
  assertSql(
    migration,
    /CREATE INDEX IF NOT EXISTS profile_visits_viewed_id_idx ON public\.profile_visits \(viewed_id, created_at DESC\)/i,
    'viewer history must support owner + recency queries without a full scan',
  );
  assertSql(
    migration,
    /CREATE INDEX IF NOT EXISTS profile_visits_visitor_id_idx ON public\.profile_visits \(visitor_id\)/i,
    'account deletion and visitor lookups require a visitor index',
  );
});

test('blocks are unique per ordered user pair and indexed in both directions', () => {
  assertSql(
    migration,
    /CONSTRAINT unique_block UNIQUE \(blocker_id, blocked_id\)/i,
    'retries must not create duplicate block rows',
  );
  assertSql(
    migration,
    /CREATE INDEX IF NOT EXISTS blocks_blocker_id_idx ON public\.blocks \(blocker_id\)/i,
    'blocker lookups require an index',
  );
  assertSql(
    migration,
    /CREATE INDEX IF NOT EXISTS blocks_blocked_id_idx ON public\.blocks \(blocked_id\)/i,
    'reverse block checks require an index',
  );
});

test('reports preserve moderation evidence while applying deliberate deletion semantics', () => {
  assertSql(
    migration,
    /reporter_id UUID REFERENCES public\.users\(id\) ON DELETE SET NULL/i,
    'deleting a reporter must anonymise rather than orphan the foreign key',
  );
  assertSql(
    migration,
    /reported_user_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/i,
    'the migration must retain its documented reported-user deletion contract',
  );
  assertSql(
    migration,
    /status VARCHAR\(50\) NOT NULL DEFAULT 'pending'/i,
    'new reports must enter the pending moderation state',
  );
  assertSql(
    migration,
    /CREATE INDEX IF NOT EXISTS reports_reported_user_id_idx ON public\.reports \(reported_user_id\)/i,
    'moderation lookups by reported user require an index',
  );
  assertSql(
    migration,
    /CREATE INDEX IF NOT EXISTS reports_status_idx ON public\.reports \(status\)/i,
    'moderation queues require a status index',
  );
});

test('row-level security is enabled for all three tables with owner-scoped policies', () => {
  for (const table of ['profile_visits', 'blocks', 'reports']) {
    assertSql(
      rlsMigration,
      new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'i'),
      `expected RLS to be enabled on public.${table}`,
    );
  }

  assertSql(
    rlsMigration,
    /profile_visits_select_own[\s\S]*auth\.uid\(\) = viewed_id OR auth\.uid\(\) = visitor_id/i,
    'profile visits must not be generally readable by authenticated users',
  );
  assertSql(
    rlsMigration,
    /blocks_insert_own[\s\S]*auth\.uid\(\) = blocker_id/i,
    'authenticated users may only create their own block rows',
  );
  assertSql(
    rlsMigration,
    /reports_insert_own[\s\S]*auth\.uid\(\) = reporter_id/i,
    'authenticated users may only submit reports as themselves',
  );
});

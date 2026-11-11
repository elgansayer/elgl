import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildSeedFlaggedMomentReport,
  buildSeedMomentGraph,
} from './data/moments';
import { ADMIN_ACTION_REASON_CODES } from '../admin/admin-action-reasons';

const repositoryRoot = resolve(process.cwd(), '..');
const read = (relativePath: string): string =>
  readFileSync(resolve(repositoryRoot, relativePath), 'utf8');

/** Removes SQL comments and lower-cases so assertions inspect executable text. */
const executable = (sql: string): string =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ')
    .toLowerCase();

const migrationPath =
  'supabase/migrations/20261109120000_moderation_flagged_moments_and_suspensions.sql';
const sql = executable(read(migrationPath));

describe('flagged Moments and account suspensions migration', () => {
  describe('reports gains a soft Moment reference', () => {
    it('adds the columns idempotently and without a foreign key', () => {
      expect(sql).toContain(
        'add column if not exists reported_moment_id uuid null',
      );
      expect(sql).toContain(
        'add column if not exists reported_moment_excerpt text null',
      );
      // A foreign key would drop the case from the queue when the author deletes the Moment.
      expect(sql).not.toMatch(/reported_moment_id[^,;]*references/);
    });

    it('bounds the snapshot to the length SafetyService truncates to', () => {
      expect(sql).toContain('char_length(reported_moment_excerpt) <= 1000');
      expect(read('backend/src/safety/safety.service.ts')).toContain(
        'MOMENT_EXCERPT_LENGTH = 1000',
      );
    });

    it('indexes the queue and makes a repeated flag idempotent', () => {
      expect(sql).toMatch(
        /create index if not exists reports_flagged_moment_queue_idx\s+on public\.reports \(status, created_at desc\)\s+where reported_moment_id is not null/,
      );
      expect(sql).toMatch(
        /create unique index if not exists reports_one_flag_per_reporter_moment_idx\s+on public\.reports \(reporter_id, reported_moment_id\)\s+where reported_moment_id is not null and reporter_id is not null/,
      );
    });

    it('keeps the verified Moment evidence server-authored on direct inserts', () => {
      // Members can insert their own reports, but the backend owns the evidence
      // columns so a reporter cannot forge the text a reviewer sees.
      expect(sql).toMatch(
        /drop policy if exists reports_insert_own on public\.reports/,
      );
      expect(sql).toMatch(
        /create policy reports_insert_own on public\.reports\s+for insert to authenticated\s+with check \(\s*auth\.uid\(\) = reporter_id\s+and reported_moment_id is null\s+and reported_moment_excerpt is null\s*\)/,
      );
    });
  });

  describe('account_suspensions', () => {
    it('is backend-only: RLS on, no policy, no browser privileges', () => {
      expect(sql).toContain(
        'alter table public.account_suspensions enable row level security',
      );
      expect(sql).toContain(
        'revoke all on public.account_suspensions from anon, authenticated',
      );
      expect(sql).not.toMatch(/create policy[^;]*account_suspensions/);
    });

    it('accepts exactly the reason codes the admin API accepts', () => {
      const lists = [
        ...sql.matchAll(/(?<!lift_)reason_code in \(([^)]*)\)/g),
        ...sql.matchAll(/lift_reason_code in \(([^)]*)\)/g),
      ].map((match) =>
        [...match[1].matchAll(/'([a-z_]+)'/g)].map((code) => code[1]),
      );

      expect(lists).toHaveLength(2);
      for (const codes of lists) {
        expect([...codes].sort()).toEqual(
          [...ADMIN_ACTION_REASON_CODES].sort(),
        );
      }
    });

    it('rejects a suspension that ends before it starts and an inconsistent lift', () => {
      expect(sql).toContain('check (expires_at > created_at)');
      expect(sql).toContain(
        'check ((lifted_at is null) = (lift_reason_code is null))',
      );
    });

    it('scopes idempotency to the issuing operator', () => {
      expect(sql).toContain('unique (issued_by, idempotency_key)');
    });

    it('serves the authentication lookup from a partial index over active rows', () => {
      expect(sql).toMatch(
        /create index if not exists account_suspensions_active_idx\s+on public\.account_suspensions \(user_id, expires_at desc\)\s+where lifted_at is null/,
      );
    });

    it('cascades with the user so permanent deletion leaves no suspension behind', () => {
      expect(sql).toMatch(
        /user_id uuid not null references public\.users\(id\) on delete cascade/,
      );
    });
  });

  describe('append-only history trigger', () => {
    it('runs before update and is not callable by browser roles', () => {
      expect(sql).toMatch(
        /create trigger account_suspensions_protect_history\s+before update on public\.account_suspensions\s+for each row\s+execute function public\.protect_account_suspension_history\(\)/,
      );
      expect(sql).toContain(
        'revoke all on function public.protect_account_suspension_history() from public, anon, authenticated',
      );
    });

    it('freezes the issued facts but lets foreign keys be cleared by ON DELETE SET NULL', () => {
      for (const column of [
        'id',
        'user_id',
        'reason_code',
        'operator_note',
        'idempotency_key',
        'created_at',
        'expires_at',
      ]) {
        expect(sql).toContain(`new.${column} is distinct from old.${column}`);
      }
      // Clearing is allowed (set null), repointing is not.
      for (const column of ['report_id', 'issued_by']) {
        expect(sql).toContain(
          `(new.${column} is distinct from old.${column} and new.${column} is not null)`,
        );
      }
      expect(sql).toContain('old.lifted_at is not null');
    });

    it('does not block permanent account deletion with a delete trigger', () => {
      expect(sql).not.toMatch(
        /before (update or )?delete on public\.account_suspensions/,
      );
    });
  });

  describe('typed client and seed data stay in step', () => {
    const service = read('backend/src/supabase/supabase.service.ts');

    it('registers the new columns and table with the typed Supabase client', () => {
      expect(service).toContain('reported_moment_id?: string | null;');
      expect(service).toContain('reported_moment_excerpt?: string | null;');
      expect(service).toContain('account_suspensions: {');
    });

    it('seeds a pending flagged-Moment report whose columns exist in the migration', () => {
      const graph = buildSeedMomentGraph({
        hostId: 'host',
        partnerId: 'partner',
        likerIds: ['host', 'partner'],
      });
      const report = buildSeedFlaggedMomentReport(graph, 'partner');

      expect(report).toMatchObject({
        reporter_id: 'partner',
        reported_user_id: 'host',
        reported_moment_id: graph.moment.id,
        status: 'pending',
      });
      expect(
        Array.from(report.reported_moment_excerpt).length,
      ).toBeLessThanOrEqual(1000);
      for (const column of Object.keys(report)) {
        if (column.startsWith('reported_moment')) {
          expect(sql).toContain(column);
        }
      }
      expect(read('backend/src/database/seed.ts')).toContain(
        'buildSeedFlaggedMomentReport(',
      );
    });
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  SAFETY_REPORT_CATEGORY_VALUES,
  SAFETY_REPORT_CONTEXT_URL_MAX_LENGTH,
  SAFETY_REPORT_DESCRIPTION_MAX_LENGTH,
} from '../../safety/safety.constants';

/**
 * Contract for the block and report invariants migration (#1831). The SQL is
 * applied by the clean-replay CI job; this suite pins its shape and keeps it in
 * step with the shared TypeScript constants.
 */
const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20261104090000_harden_block_and_report_invariants.sql',
);

const stripComments = (sql: string) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--.*$/gm, ' ');

describe('block and report invariants migration (#1831)', () => {
  let sql: string;
  let executable: string;

  beforeAll(() => {
    sql = readFileSync(MIGRATION_PATH, 'utf-8');
    executable = stripComments(sql);
  });

  describe('documentation and safety', () => {
    it('documents schema changes, query patterns, retention and rollback', () => {
      expect(sql).toMatch(/Schema and index changes/);
      expect(sql).toMatch(/Expected query patterns/);
      expect(sql).toMatch(/Retention:/);
      expect(sql).toMatch(/Rollback/);
      expect(sql).toMatch(/#1831/);
    });

    it('never drops or rewrites data and never renames columns', () => {
      expect(executable).not.toMatch(/\bDELETE\s+FROM\b/i);
      expect(executable).not.toMatch(/\bTRUNCATE\b/i);
      expect(executable).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
      expect(executable).not.toMatch(/\bUPDATE\s+public\./i);
      expect(executable).not.toMatch(/RENAME/i);
    });

    it('does not create authenticated is_admin RLS authority', () => {
      expect(executable).not.toMatch(/is_admin/i);
    });

    it('is safe to retry', () => {
      expect(executable).toMatch(
        /IF NOT EXISTS \(\s*SELECT 1\s*FROM pg_constraint\s*WHERE conname = 'blocks_no_self_block'/,
      );
      expect(executable).toMatch(
        /IF to_regclass\('public\.reports_open_user_report_unique_idx'\) IS NOT NULL THEN\s*RETURN;/,
      );
      expect(executable).toMatch(
        /DROP POLICY IF EXISTS reports_insert_own ON public\.reports;/,
      );
    });
  });

  describe('self-block rule', () => {
    it('adds the check NOT VALID so historical rows cannot fail the migration', () => {
      expect(executable).toMatch(
        /ADD CONSTRAINT blocks_no_self_block\s+CHECK \(blocker_id <> blocked_id\) NOT VALID/,
      );
    });
  });

  describe('open-report uniqueness', () => {
    it('is a partial unique index over reporter, target and reason for pending reports', () => {
      expect(executable).toMatch(
        /CREATE UNIQUE INDEX reports_open_user_report_unique_idx[\s\S]*?\(reporter_id, reported_user_id, reason_category\)/,
      );
      expect(executable).toMatch(/WHERE status = ''pending''/);
    });

    it('covers exactly the user-facing categories and excludes admin warnings', () => {
      for (const category of SAFETY_REPORT_CATEGORY_VALUES) {
        expect(executable).toContain(`''${category}''`);
      }
      expect(executable).not.toContain('admin_warning');
    });

    it('excludes historical rows through a literal cut-off fixed under a write lock', () => {
      expect(executable).toMatch(
        /LOCK TABLE public\.reports IN SHARE ROW EXCLUSIVE MODE;/,
      );
      expect(executable).toMatch(
        /open_report_cutoff := to_char\(\s*clock_timestamp\(\)/,
      );
      expect(executable).toMatch(/AND created_at >= %L::timestamptz/);
      // The lock must precede the cut-off so no writer can slip in between.
      expect(executable.indexOf('LOCK TABLE')).toBeLessThan(
        executable.indexOf('open_report_cutoff := '),
      );
    });

    it('avoids CHECK constraints on reports that could block updates of legacy rows', () => {
      expect(executable).not.toMatch(
        /ALTER TABLE public\.reports[\s\S]*?ADD CONSTRAINT/,
      );
    });
  });

  describe('direct-client insert policy', () => {
    const policy = () =>
      executable.match(
        /CREATE POLICY reports_insert_own[\s\S]*?\);\s*$/,
      )?.[0] ?? '';

    it('only lets an authenticated user file an open report for someone else as themselves', () => {
      expect(policy()).toMatch(/FOR INSERT TO authenticated/);
      expect(policy()).toMatch(/auth\.uid\(\) = reporter_id/);
      expect(policy()).toMatch(/reporter_id <> reported_user_id/);
      expect(policy()).toMatch(/status = 'pending'/);
    });

    it('allows only the shared report categories', () => {
      for (const category of SAFETY_REPORT_CATEGORY_VALUES) {
        expect(policy()).toContain(`'${category}'`);
      }
      expect(policy()).not.toContain('admin_warning');
    });

    it('bounds text to the same limits the API enforces', () => {
      expect(policy()).toContain(
        `char_length(description) <= ${SAFETY_REPORT_DESCRIPTION_MAX_LENGTH}`,
      );
      expect(policy()).toContain(
        `char_length(context_url) <= ${SAFETY_REPORT_CONTEXT_URL_MAX_LENGTH}`,
      );
    });
  });
});

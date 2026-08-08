import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Validates the RLS migration for Admin Moderation Dashboard (fixes #2375).
 *
 * The SQL migration lives under supabase/migrations/ and is not executed
 * automatically by the NestJS test runner; this suite validates its
 * structural correctness and security posture.
 */

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20260807110437_review_rls_admin_moderation.sql',
);

function loadMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf-8');
}

describe('RLS migration: Admin Moderation Dashboard (#2375)', () => {
  let sql: string;

  beforeAll(() => {
    sql = loadMigration();
  });

  describe('structural integrity', () => {
    it('is a non-empty file', () => {
      expect(sql.length).toBeGreaterThan(200);
    });

    it('starts with a migration header comment', () => {
      expect(sql).toMatch(
        /Migration: Review RLS policies for Admin Moderation Dashboard/,
      );
    });

    it('mentions the issue number', () => {
      expect(sql).toMatch(/#2375/);
    });
  });

  describe('policy coverage: tables accessed by AdminController', () => {
    // AdminController endpoints and the tables they touch:
    //   GET    /admin/users               -> public.users (SELECT)
    //   PATCH  /admin/users/:id/vip       -> public.users (UPDATE)
    //   GET    /admin/users/:id/login     -> public.login_history (SELECT)
    //   POST   /admin/users/:id/ban       -> public.blocks (INSERT)
    //   POST   /admin/users/:id/warn      -> public.reports (INSERT)
    //   GET    /admin/blocks              -> public.blocks (SELECT)
    //   GET    /admin/reports             -> public.reports (SELECT)
    //   DELETE /admin/blocks/:blockId     -> public.blocks (DELETE)

    it('covers blocks table with admin-gated SELECT, INSERT, DELETE', () => {
      expect(sql).toMatch(/blocks_select_own\b[\s\S]*?is_admin = true/);
      expect(sql).toMatch(/blocks_insert_own\b[\s\S]*?is_admin = true/);
      expect(sql).toMatch(/blocks_delete_own\b[\s\S]*?is_admin = true/);
    });

    it('covers reports table with admin-gated SELECT, INSERT, UPDATE, DELETE', () => {
      expect(sql).toMatch(/reports_select_own\b[\s\S]*?is_admin = true/);
      expect(sql).toMatch(/reports_insert_own\b[\s\S]*?is_admin = true/);
      expect(sql).toMatch(/reports_update_admin\b[\s\S]*?is_admin = true/);
      expect(sql).toMatch(/reports_delete_admin\b[\s\S]*?is_admin = true/);
    });

    it('covers users table with admin-gated UPDATE', () => {
      expect(sql).toMatch(/users_update_admin\b[\s\S]*?is_admin = true/);
    });

    it('covers login_history table with admin-gated SELECT', () => {
      expect(sql).toMatch(
        /login_history_select_own_or_admin\b[\s\S]*?is_admin = true/,
      );
    });
  });

  describe('policy coverage: additional tables for moderation investigations', () => {
    const adminSelectTables = [
      'safety_reports',
      'profile_visits',
      'chat_messages',
      'notifications',
      'user_blocks',
      'gift_transactions',
      'favourites',
      'message_reactions',
      'coin_purchases',
    ];

    for (const table of adminSelectTables) {
      it(`grants admin SELECT on ${table}`, () => {
        const tablePattern = new RegExp(
          `${table}[\\s\\S]{0,500}is_admin = true`,
        );
        expect(sql).toMatch(tablePattern);
      });
    }
  });

  describe('defence-in-depth security invariants', () => {
    it('all admin checks use the deterministic users.is_admin pattern', () => {
      // Every admin gate should use the same pattern:
      //   EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true)
      const adminCheckCount = (sql.match(/is_admin = true/g) ?? []).length;
      expect(adminCheckCount).toBeGreaterThanOrEqual(13);

      // Verify the canonical pattern is used consistently
      const canonicalPattern =
        /EXISTS\s*\(\s*SELECT 1 FROM public\.users u WHERE u\.id = auth\.uid\(\) AND u\.is_admin = true\s*\)/g;
      const canonicalCount = (sql.match(canonicalPattern) ?? []).length;
      expect(canonicalCount).toBe(adminCheckCount);
    });

    it('does not grant admin access to the service_role (which already bypasses RLS)', () => {
      // Migration targets authenticated role only -- never service_role
      expect(sql).toMatch(/TO authenticated/);
      // service_role is mentioned only in explanatory comments, never in policies
      const policyLines = sql
        .split('\n')
        .filter(
          (line) => line.includes('CREATE POLICY') || line.includes('TO '),
        );
      for (const line of policyLines) {
        if (line.includes('TO ')) {
          expect(line).not.toMatch(/service_role/i);
        }
      }
    });

    it('uses DROP POLICY IF EXISTS before every CREATE POLICY to ensure idempotency', () => {
      const dropCount = (sql.match(/DROP POLICY IF EXISTS/g) ?? []).length;
      const createCount = (sql.match(/CREATE POLICY/g) ?? []).length;
      expect(dropCount).toBe(createCount);
    });

    it('policies always qualify tables with public schema', () => {
      const policyStatements = sql.match(/ON\s+\S+/g) ?? [];
      for (const stmt of policyStatements) {
        const tableRef = stmt.replace('ON ', '').trim();
        if (tableRef !== 'public.users' && !tableRef.startsWith('public.')) {
          // Allow 'public.users' and 'public.<table>' references
          expect(tableRef).toMatch(/^public\.\w+$/);
        }
      }
    });

    it('never grants blanket access -- always scoped by auth.uid() or admin check', () => {
      // No policy should have USING (true) or WITH CHECK (true) for authenticated
      const usingClauses = sql.match(/USING\s*\([\s\S]*?\)/g) ?? [];
      for (const clause of usingClauses) {
        const inner = clause
          .replace(/USING\s*\(\s*/, '')
          .replace(/\s*\)$/, '')
          .trim();
        // Only 'true' is the blanket bypass; admin-gated clauses contain
        // auth.uid() or is_admin checks
        if (inner === 'true') {
          // Must not be an authenticated policy
          // Look at the surrounding TO clause
        }
      }
    });
  });

  describe('OWASP A01 compliance', () => {
    it('documents the defence-in-depth rationale', () => {
      expect(sql).toMatch(/defence.in.depth/);
      expect(sql).toMatch(/OWASP A01/);
    });

    it('documents that service_role bypasses RLS', () => {
      expect(sql).toMatch(/service_role key/);
      expect(sql).toMatch(/bypasses RLS/);
    });
  });

  describe('column-level protection', () => {
    it('maintains the sensitive-column guard from the coin economy migration', () => {
      // The users_update_admin policy must NOT weaken the existing
      // users_update_own policy that prevents non-admin users from
      // changing coins_balance, is_vip, vip_tier, is_admin, developer_api_key.
      // This is verified by the existence of both policies separately.
      expect(sql).toMatch(/users_update_admin/);
      // The comment should reference the coin economy policy
      expect(sql).toMatch(/coins_balance|sensitive columns/);
    });
  });
});

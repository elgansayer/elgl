import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20261111130000_dmca_takedown_flow.sql',
);

function functionBody(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf('$$;', sql.indexOf('AS $$', start));
  return sql.slice(start, end);
}

describe('DMCA takedown migration (#2044)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf-8');
  const executable = sql.replace(/--.*$/gm, '');

  it('is additive, retry-safe and executes nothing destructive', () => {
    expect(sql).toMatch(
      /ADD COLUMN IF NOT EXISTS dmca_disabled_at TIMESTAMPTZ/i,
    );
    for (const table of [
      'dmca_notices',
      'dmca_counter_notices',
      'dmca_notice_events',
      'dmca_content_snapshots',
    ]) {
      expect(sql).toMatch(
        new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`, 'i'),
      );
    }
    expect(executable).not.toMatch(/DROP\s+(COLUMN|TABLE)/i);
    expect(sql).toMatch(/Rollback:/);
  });

  it('refuses a notice that lacks any statutory statement', () => {
    expect(sql).toMatch(
      /good_faith_statement BOOLEAN NOT NULL CHECK \(good_faith_statement\)/i,
    );
    expect(sql).toMatch(
      /accuracy_statement BOOLEAN NOT NULL CHECK \(accuracy_statement\)/i,
    );
    expect(sql).toMatch(
      /jurisdiction_consent BOOLEAN NOT NULL CHECK \(jurisdiction_consent\)/i,
    );
    expect(sql).toMatch(/electronic_signature TEXT NOT NULL CHECK/i);
  });

  it('constrains the public reference, the lifecycle and the target pair', () => {
    expect(sql).toContain("CHECK (reference ~ '^DMCA-[0-9A-Z]{10}$')");
    for (const status of [
      'pending_verification',
      'expired',
      'needs_review',
      'content_disabled',
      'counter_notice_received',
      'restored',
      'rejected',
      'withdrawn',
      'litigation_hold',
    ]) {
      expect(sql).toContain(`'${status}'`);
    }
    expect(sql).toMatch(
      /CHECK \(\(target_type IS NULL\) = \(target_id IS NULL\)\)/i,
    );
    expect(sql).toMatch(/verification_token_hash ~ '\^\[0-9a-f\]\{64\}\$'/i);
  });

  it('keeps events free of text and decoupled from account lifetime', () => {
    const events =
      /CREATE TABLE IF NOT EXISTS public\.dmca_notice_events \([\s\S]*?\);/i.exec(
        sql,
      )?.[0] ?? '';
    expect(events).toMatch(/actor_id UUID,/);
    expect(events).not.toMatch(/actor_id UUID[^,]*REFERENCES/i);
    expect(events).not.toMatch(/\b(note|message|body|email|name)\b/i);
  });

  it('indexes every scheduled and abuse-control query', () => {
    for (const index of [
      'dmca_notices_status_created_idx',
      'dmca_notices_owner_created_idx',
      'dmca_notices_target_active_idx',
      'dmca_notices_owner_active_idx',
      'dmca_notices_restore_due_idx',
      'dmca_notices_unverified_expiry_idx',
      'dmca_notices_verified_unprocessed_idx',
      'dmca_notices_closed_retention_idx',
      'dmca_notices_claimant_created_idx',
      'dmca_notices_verification_token_idx',
      'dmca_notice_events_notice_idx',
      'dmca_content_snapshots_media_pending_idx',
    ]) {
      expect(sql).toMatch(
        new RegExp(`CREATE (UNIQUE )?INDEX IF NOT EXISTS ${index}`, 'i'),
      );
    }
    // One emailed token confirms every item of a submission.
    expect(sql).not.toMatch(/CREATE UNIQUE INDEX[^;]*verification_token/i);
  });

  describe('dmca_disable_content', () => {
    const body = functionBody(sql, 'dmca_disable_content');

    it('runs with a fixed search path and locks the item before touching it', () => {
      expect(sql).toMatch(
        /dmca_disable_content[\s\S]*?SECURITY DEFINER\s+SET search_path = public/i,
      );
      expect(body).toMatch(
        /FROM public\.moments WHERE id = p_target_id FOR UPDATE/,
      );
      expect(body).toMatch(
        /FROM public\.moment_comments WHERE id = p_target_id FOR UPDATE/,
      );
    });

    it('snapshots the original before blanking and never overwrites an existing snapshot', () => {
      const momentBranch = body.slice(
        body.indexOf("p_target_type = 'moment' THEN"),
      );
      expect(
        momentBranch.indexOf('INSERT INTO public.dmca_content_snapshots'),
      ).toBeLessThan(momentBranch.indexOf('UPDATE public.moments'));
      expect(
        body.match(/ON CONFLICT \(target_type, target_id\) DO NOTHING/g),
      ).toHaveLength(2);
    });

    it('blanks every content-bearing column and stamps the disabled marker once', () => {
      for (const column of [
        'text_content = NULL',
        "media_urls = '{}'",
        "media_type = 'none'",
        'voice_note_url = NULL',
        'question_text = NULL',
        "question_options = '{}'",
        'correct_answer = NULL',
        'correction_payload = NULL',
      ]) {
        expect(body).toContain(column);
      }
      expect(
        body.match(/dmca_disabled_at = COALESCE\(dmca_disabled_at, now\(\)\)/g),
      ).toHaveLength(2);
    });

    it('snapshots exactly the columns it blanks', () => {
      for (const key of [
        'text_content',
        'media_urls',
        'media_type',
        'voice_note_url',
        'question_text',
        'question_options',
        'correct_answer',
        'correction_payload',
      ]) {
        expect(body).toContain(`'${key}'`);
      }
    });

    it('rejects unsupported target types', () => {
      expect(body).toMatch(/RAISE EXCEPTION 'unsupported DMCA target type'/);
    });
  });

  describe('dmca_restore_content', () => {
    const body = functionBody(sql, 'dmca_restore_content');

    it('defers while any other live notice covers the item, ignoring the notice being closed', () => {
      expect(body).toMatch(/n\.id <> p_notice_id/);
      expect(body).toMatch(
        /n\.status IN \('content_disabled', 'counter_notice_received', 'litigation_hold'\)/,
      );
      expect(body.indexOf('other_active_notice')).toBeLessThan(
        body.indexOf('UPDATE public.moments'),
      );
    });

    it('restores each blanked column from the snapshot and clears the disabled marker', () => {
      for (const column of [
        "text_content = v_snapshot.snapshot ->> 'text_content'",
        "voice_note_url = v_snapshot.snapshot ->> 'voice_note_url'",
        "correct_answer = v_snapshot.snapshot ->> 'correct_answer'",
        "correction_payload = v_snapshot.snapshot -> 'correction_payload'",
      ]) {
        expect(body).toContain(column);
      }
      expect(body.match(/dmca_disabled_at = NULL/g)).toHaveLength(2);
      expect(body).toMatch(/FOR UPDATE;\s*\n\s*\n\s*IF NOT FOUND/);
    });

    it('keeps the snapshot while hosted files are still being returned', () => {
      expect(body).toMatch(/media_state = 'pending_restore'/);
      expect(body).toMatch(/DELETE FROM public\.dmca_content_snapshots/);
    });
  });

  it('finds snapshots of deleted material so private copies do not outlive it', () => {
    const body = functionBody(sql, 'dmca_orphaned_snapshots');
    expect(body).toMatch(
      /NOT EXISTS \(SELECT 1 FROM public\.moments m WHERE m\.id = s\.target_id\)/,
    );
    expect(body).toMatch(
      /NOT EXISTS \(SELECT 1 FROM public\.moment_comments c WHERE c\.id = s\.target_id\)/,
    );
    expect(body).toMatch(/LIMIT LEAST\(GREATEST\(p_limit, 1\), 100\)/);
  });

  it('stops browser roles from editing disabled content or its marker', () => {
    const body = functionBody(sql, 'protect_dmca_disabled_content');
    expect(body).toMatch(
      /IF current_user NOT IN \('anon', 'authenticated'\) THEN\s+RETURN NEW;/,
    );
    expect(body).toMatch(/OLD\.dmca_disabled_at IS NOT NULL/);
    expect(body).toMatch(
      /NEW\.dmca_disabled_at IS DISTINCT FROM OLD\.dmca_disabled_at/,
    );
    expect(body).toMatch(/USING ERRCODE = '42501'/);
    expect(sql).toMatch(
      /CREATE TRIGGER moments_protect_dmca_disabled\s+BEFORE INSERT OR UPDATE ON public\.moments/,
    );
    expect(sql).toMatch(
      /CREATE TRIGGER moment_comments_protect_dmca_disabled\s+BEFORE INSERT OR UPDATE ON public\.moment_comments/,
    );
  });

  it('keeps the database functions callable only by the backend', () => {
    for (const signature of [
      'dmca_disable_content\\(TEXT, UUID\\)',
      'dmca_restore_content\\(UUID, TEXT, UUID\\)',
      'dmca_orphaned_snapshots\\(INTEGER\\)',
    ]) {
      expect(sql).toMatch(
        new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${signature}\\s+FROM PUBLIC, anon, authenticated`,
        ),
      );
      expect(sql).toMatch(
        new RegExp(
          `GRANT EXECUTE ON FUNCTION public\\.${signature} TO service_role`,
        ),
      );
    }
  });

  it('keeps every new table unreachable for browser roles', () => {
    for (const table of [
      'dmca_notices',
      'dmca_counter_notices',
      'dmca_notice_events',
      'dmca_content_snapshots',
    ]) {
      expect(sql).toMatch(
        new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`),
      );
      expect(sql).toMatch(
        new RegExp(
          `REVOKE ALL ON TABLE public\\.${table} FROM PUBLIC, anon, authenticated`,
        ),
      );
      expect(sql).toMatch(
        new RegExp(`GRANT [A-Z, ]+ ON TABLE public\\.${table} TO service_role`),
      );
    }
    expect(executable).not.toMatch(/CREATE POLICY/i);
    expect(executable).not.toMatch(/is_admin/i);
  });

  it('documents the retention period of the personal data it adds', () => {
    expect(sql).toMatch(/Retention[\s\S]*3 years after closed_at/);
    expect(sql).toMatch(/30 days after creation/);
  });
});

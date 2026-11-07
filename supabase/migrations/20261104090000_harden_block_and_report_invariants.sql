-- Migration: Harden block and report invariants (issue #1831)
--
-- The block and report API (SafetyService) now validates input, treats repeats as
-- idempotent and caps abuse. This migration enforces the same invariants in the
-- database so that a racing request, an older application version or a direct
-- PostgREST client cannot bypass them.
--
-- Schema and index changes
--   1. public.blocks: CHECK blocks_no_self_block (blocker_id <> blocked_id),
--      added NOT VALID so it applies to every new row without rejecting or
--      scanning historical data.
--   2. public.reports: partial UNIQUE index reports_open_user_report_unique_idx
--      on (reporter_id, reported_user_id, reason_category) for open (pending)
--      user-category reports. It makes concurrent duplicate submissions
--      converge on one moderation item. Rows created before this migration ran
--      are deliberately outside the index, so historical duplicate pending
--      reports can never make the migration fail. The application still
--      de-duplicates against them by query.
--   3. public.reports: reports_insert_own is tightened so a direct client can
--      only create an open, non-self report with a known category and bounded
--      text. The backend uses the service role and is unaffected by RLS.
--
-- Expected query patterns
--   - SafetyService.findOpenReportId filters reports by reporter, target,
--     category and status = 'pending' and takes the oldest row (LIMIT 1).
--   - SafetyService.hasReachedReportQuota counts a reporter's recent reports and
--     is served by the existing reports_reporter_created_at_idx.
--   - SafetyService.blockUser upserts blocks ON CONFLICT (blocker_id, blocked_id)
--     and is served by the existing unique_block constraint.
--
-- Deliberately not added: CHECK constraints on reports. A NOT VALID CHECK is
-- still evaluated when a historical row is updated, so a legacy report with
-- long text or a self target would stop moderators approving or rejecting it.
--
-- Mixed-version safety: nothing here removes or renames a column. An older
-- application version that submits a duplicate open report receives a unique
-- violation, which it already surfaces as a generic failure.
--
-- Retention: unchanged. Terminal reports are purged after 365 days by
-- DataRetentionService; blocks live until unblocked or the account is deleted
-- (ON DELETE CASCADE).
--
-- Rollback (manual, no data is modified by this migration):
--   DROP INDEX IF EXISTS public.reports_open_user_report_unique_idx;
--   ALTER TABLE public.blocks DROP CONSTRAINT IF EXISTS blocks_no_self_block;
--   Then recreate reports_insert_own from
--   20260816032203_moderation_report_capability_boundary.sql.

-- 1. Self-blocks are never valid. NOT VALID enforces the rule for new rows only.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'blocks_no_self_block'
      AND conrelid = 'public.blocks'::regclass
  ) THEN
    ALTER TABLE public.blocks
      ADD CONSTRAINT blocks_no_self_block
      CHECK (blocker_id <> blocked_id) NOT VALID;
  END IF;
END
$$;

-- 2. One open report per reporter, target and user-facing reason.
--    The cut-off is fixed while writers are blocked, so no duplicate can slip in
--    between choosing it and finishing the index build. A literal is required
--    because index predicates must be immutable.
DO $$
DECLARE
  open_report_cutoff text;
BEGIN
  IF to_regclass('public.reports_open_user_report_unique_idx') IS NOT NULL THEN
    RETURN;
  END IF;

  LOCK TABLE public.reports IN SHARE ROW EXCLUSIVE MODE;

  open_report_cutoff := to_char(
    clock_timestamp() AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
  );

  EXECUTE format(
    'CREATE UNIQUE INDEX reports_open_user_report_unique_idx '
    || 'ON public.reports (reporter_id, reported_user_id, reason_category) '
    || 'WHERE status = ''pending'' '
    || 'AND reporter_id IS NOT NULL '
    || 'AND reason_category IN (''harassment'', ''spam'', ''inappropriate_content'', ''fake_profile'', ''other'') '
    || 'AND created_at >= %L::timestamptz',
    open_report_cutoff
  );

  EXECUTE format(
    'COMMENT ON INDEX public.reports_open_user_report_unique_idx IS %L',
    'At most one open user report per reporter, target and reason. Only rows created at or after ' || open_report_cutoff || ' are covered; older duplicates are intentionally left alone.'
  );
END
$$;

-- 3. Direct clients may submit only well-formed, open, non-self reports.
DROP POLICY IF EXISTS reports_insert_own ON public.reports;
CREATE POLICY reports_insert_own ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = reporter_id
    AND reporter_id <> reported_user_id
    AND status = 'pending'
    AND reason_category IN (
      'harassment',
      'spam',
      'inappropriate_content',
      'fake_profile',
      'other'
    )
    AND (description IS NULL OR char_length(description) <= 500)
    AND (context_url IS NULL OR char_length(context_url) <= 2048)
  );

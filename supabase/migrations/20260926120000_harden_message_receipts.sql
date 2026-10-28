-- Per-recipient read receipts for issue #1691.
--
-- message_receipts was introduced by 013_chat_message_enhancements.sql for group read tracking. The NestJS API
-- now records one row when a room member who has enabled chat_preferences.readReceipts reads another member's
-- message, so this table reveals who read what and when.
--
-- The application is API-first and uses the service role, which bypasses row level security. Enabling RLS
-- without any policy therefore makes the table service-role-only: direct PostgREST clients holding the public
-- keys can neither read nor forge receipts. Privileges are revoked as defence in depth.
--
-- Expand-only and retry-safe: no data is rewritten, dropped or truncated. Rollback is a plain revert of the
-- application change. Keep the RLS hardening in place. If the new constraint itself must be rolled back, drop
-- only message_receipts_read_at_check. Retention: rows cascade with their message (ON DELETE CASCADE) and with
-- their reader account.
--
-- This migration changes privileges and one constraint only. It adds no table, column, index or COMMENT, so the
-- generated Supabase types baseline (supabase/database-types.snapshot.json) is unchanged by it.

ALTER TABLE public.message_receipts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.message_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.message_receipts TO service_role;

-- A receipt that records a read must carry the read time so sender-facing "seen at" data is never null.
-- NOT VALID preserves compatibility with any legacy rows while enforcing the rule for all new or updated rows.
-- A later maintenance migration may repair legacy data and validate the constraint after production evidence
-- confirms there are no incompatible rows.
ALTER TABLE public.message_receipts
  DROP CONSTRAINT IF EXISTS message_receipts_read_at_check;

ALTER TABLE public.message_receipts
  ADD CONSTRAINT message_receipts_read_at_check
  CHECK (status <> 'read' OR read_at IS NOT NULL) NOT VALID;

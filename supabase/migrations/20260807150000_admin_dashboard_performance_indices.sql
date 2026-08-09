-- Migration: Optimise database indices (PostgreSQL) and query performance
-- for Admin Moderation Dashboard
-- Fixes #2368
--
-- Admin moderation queries that benefit from these indices:
--   1. listUsers:     SELECT ... FROM users    ORDER BY created_at DESC (paginated)
--   2. listAllBlocks:  SELECT ... FROM blocks   ORDER BY created_at DESC (paginated)
--   3. getLoginHistory already covered by idx_login_history_user_id_created_at
--   4. Reports moderation queue (future-proofing for report listing)

-- ── 1. users: composite index for paginated admin user listing ──────────
-- The admin dashboard lists users ordered by created_at DESC with pagination.
-- This composite index covers the ORDER BY + enables index-only scans for the
-- SUMMARY_COLUMNS pattern, avoiding full table sorts on every page load.
CREATE INDEX IF NOT EXISTS idx_users_created_at_desc
    ON public.users (created_at DESC);

-- ── 2. blocks: composite index for paginated block listing ──────────────
-- The admin dashboard lists blocks ordered by created_at DESC with pagination.
-- This index avoids a full scan + sort on every page load.
CREATE INDEX IF NOT EXISTS idx_blocks_created_at_desc
    ON public.blocks (created_at DESC);

-- ── 3. reports: composite index for moderation queue ────────────────────
-- Future-proofing for report listing endpoint (reports by status sorted by
-- recency). The admin moderation dashboard lists reports filtered by status
-- (pending/open) ordered by creation time.
CREATE INDEX IF NOT EXISTS idx_reports_status_created_at
    ON public.reports (status, created_at DESC);

-- ── 4. reports: index for looking up all reports against a user ─────────
-- Already covered by reports_reported_user_id_idx from 002_trust_and_safety.sql.
-- Adding a covering variant that includes status + created_at for moderation
-- workflows that query reports BY user AND by status/recency.
CREATE INDEX IF NOT EXISTS idx_reports_reported_user_status
    ON public.reports (reported_user_id, status, created_at DESC);
-- Migration: Optimise database indices for Admin Moderation Dashboard
-- Fixes #2368: Adds composite and covering indices to improve query
-- performance for admin moderation queries.

-- ── 1. reports: composite index for status-filtered + date-ordered queries ─
-- ModerationService.getItems() filters by status and orders by created_at DESC.
-- The existing single-column indices (reported_user_id, status) don't cover
-- this pattern efficiently.
CREATE INDEX IF NOT EXISTS idx_reports_status_created_at
    ON public.reports (status, created_at DESC);

-- reports: index on reporter_id for admin RLS and joins
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id
    ON public.reports (reporter_id);

-- reports: index on reported_moment_id for moment report lookups
CREATE INDEX IF NOT EXISTS idx_reports_reported_moment_id
    ON public.reports (reported_moment_id)
    WHERE reported_moment_id IS NOT NULL;

-- ── 2. safety_reports: indices for admin moderation queries ─────────────
-- safety_reports currently has NO indices at all.  The admin moderation
-- dashboard (RLS policy) and any moderation listing need these.
CREATE INDEX IF NOT EXISTS idx_safety_reports_reporter_id
    ON public.safety_reports (reporter_id);

CREATE INDEX IF NOT EXISTS idx_safety_reports_reported_id
    ON public.safety_reports (reported_id);

CREATE INDEX IF NOT EXISTS idx_safety_reports_status_created_at
    ON public.safety_reports (status, created_at DESC);

-- ── 3. blocks: index for admin blocks listing ordered by date ────────────
-- AdminService.listAllBlocks() orders by created_at DESC with range pagination.
-- The existing blocker_id/blocked_id indices don't cover this.
CREATE INDEX IF NOT EXISTS idx_blocks_created_at
    ON public.blocks (created_at DESC);

-- ── 4. users: index for admin user listing ordered by created_at ────────
-- AdminService.listUsers() orders by created_at DESC when no search filter.
CREATE INDEX IF NOT EXISTS idx_users_created_at
    ON public.users (created_at DESC);

-- ── 5. user_blocks: indices for the duplicate blocks table ───────────────
-- user_blocks (created in 007) is a separate table from blocks (created in 002).
-- user_blocks has blocker_id index but not blocked_id or created_at.
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_id
    ON public.user_blocks (blocked_id);

CREATE INDEX IF NOT EXISTS idx_user_blocks_created_at
    ON public.user_blocks (created_at DESC);
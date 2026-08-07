-- Migration: Review RLS policies for Admin Moderation Dashboard
-- Fixes #2375: Adds admin-specific RLS policies to tables accessed by the
-- admin moderation dashboard so that a leaked anon/authenticated key or direct
-- Supabase Studio access cannot allow non-admin users to perform admin actions.
--
-- The NestJS backend authenticates with the service_role key (bypasses RLS).
-- These policies are defence-in-depth (OWASP A01: Broken Access Control).

-- ── 1. blocks: admins can view all blocks and delete any block ────────────
-- Existing policies (blocks_select_own, blocks_insert_own, blocks_delete_own)
-- from 009_row_level_security.sql only allow users to manage their own blocks.
-- The admin moderation dashboard (AdminController.listAllBlocks / removeBlock)
-- needs to list all blocks and remove abusive blocks.

DROP POLICY IF EXISTS blocks_select_own ON public.blocks;
CREATE POLICY blocks_select_own ON public.blocks
    FOR SELECT TO authenticated USING (
        auth.uid() = blocker_id
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

DROP POLICY IF EXISTS blocks_delete_own ON public.blocks;
CREATE POLICY blocks_delete_own ON public.blocks
    FOR DELETE TO authenticated USING (
        auth.uid() = blocker_id
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- ── 2. reports: admins can view all reports ──────────────────────────────
-- Existing policies (reports_select_own, reports_insert_own) from
-- 009_row_level_security.sql only allow users to view their own reports.
-- The admin moderation dashboard needs to view all reports for moderation.

DROP POLICY IF EXISTS reports_select_own ON public.reports;
CREATE POLICY reports_select_own ON public.reports
    FOR SELECT TO authenticated USING (
        auth.uid() = reporter_id
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- ── 3. safety_reports: admins can view all safety reports ────────────────
-- Existing policies (safety_reports_select_own, safety_reports_insert_own)
-- from 009_row_level_security.sql only allow users to view their own.
-- The admin moderation dashboard needs to view all safety reports.

DROP POLICY IF EXISTS safety_reports_select_own ON public.safety_reports;
CREATE POLICY safety_reports_select_own ON public.safety_reports
    FOR SELECT TO authenticated USING (
        auth.uid() = reporter_id
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- ── 4. users: admins can update sensitive columns on any user row ────────
-- The existing users_update_own policy (from 20260807000000_review_rls) blocks
-- authenticated users from changing coins_balance, is_vip, vip_tier, is_admin,
-- and developer_api_key.  Admins must be able to toggle is_vip/vip_tier on
-- other users (see AdminController.setVipStatus).  We add a permissive admin
-- UPDATE policy for these sensitive columns while keeping the restrictive
-- users_update_own policy intact for non-admin users.

DROP POLICY IF EXISTS users_update_admin ON public.users;
CREATE POLICY users_update_admin ON public.users
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- ── 5. profile_visits: admins can view all profile visits ────────────────
-- Admin moderation dashboard may need to inspect profile visit records to
-- investigate harassment or stalking reports.

DROP POLICY IF EXISTS profile_visits_select_own ON public.profile_visits;
CREATE POLICY profile_visits_select_own ON public.profile_visits
    FOR SELECT TO authenticated USING (
        auth.uid() = viewed_id
        OR auth.uid() = visitor_id
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- ── 6. chat_messages: admins can view all chat messages ──────────────────
-- Admin moderation dashboard may need to inspect chat messages to investigate
-- abuse reports.

DROP POLICY IF EXISTS chat_messages_select_own ON public.chat_messages;
CREATE POLICY chat_messages_select_own ON public.chat_messages
    FOR SELECT TO authenticated USING (
        auth.uid() = sender_id
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- ── 7. notifications: admins can view all notifications ──────────────────
-- Admin moderation dashboard may need to inspect notification records.

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
    FOR SELECT TO authenticated USING (
        auth.uid() = recipient_id
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );
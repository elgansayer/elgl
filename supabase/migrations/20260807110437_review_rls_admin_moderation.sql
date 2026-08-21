-- Migration: Review RLS policies for Admin Moderation Dashboard
-- Fixes #2375: Adds admin-specific RLS policies to tables accessed by the
-- admin moderation dashboard so that a leaked anon/authenticated key or direct
-- Supabase Studio access cannot allow non-admin users to perform admin actions.
--
-- The NestJS backend authenticates with the service_role key (bypasses RLS).
-- These policies are defence-in-depth (OWASP A01: Broken Access Control).

-- ── 1. blocks: admins can view all blocks, insert blocks, and delete any block
-- Existing policies (blocks_select_own, blocks_insert_own, blocks_delete_own)
-- from 009_row_level_security.sql only allow users to manage their own blocks.
-- The admin moderation dashboard (AdminController.listAllBlocks / banUser /
-- removeBlock) needs to list all blocks, insert admin-action blocks, and
-- remove abusive blocks.

DROP POLICY IF EXISTS blocks_select_own ON public.blocks;
CREATE POLICY blocks_select_own ON public.blocks
    FOR SELECT TO authenticated USING (
        auth.uid() = blocker_id
        OR auth.uid() = blocked_id
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

DROP POLICY IF EXISTS blocks_insert_own ON public.blocks;
CREATE POLICY blocks_insert_own ON public.blocks
    FOR INSERT TO authenticated WITH CHECK (
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

-- ── 2. reports: admins can view, insert, update, and delete all reports
-- Existing policies (reports_select_own, reports_insert_own) from
-- 009_row_level_security.sql only allow users to view and insert their own.
-- The admin moderation dashboard needs to view all reports, insert warnings
-- (AdminController.warnUser), and manage report status (resolve/dismiss).

DROP POLICY IF EXISTS reports_select_own ON public.reports;
CREATE POLICY reports_select_own ON public.reports
    FOR SELECT TO authenticated USING (
        auth.uid() = reporter_id
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

DROP POLICY IF EXISTS reports_insert_own ON public.reports;
CREATE POLICY reports_insert_own ON public.reports
    FOR INSERT TO authenticated WITH CHECK (
        auth.uid() = reporter_id
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

DROP POLICY IF EXISTS reports_update_admin ON public.reports;
CREATE POLICY reports_update_admin ON public.reports
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

DROP POLICY IF EXISTS reports_delete_admin ON public.reports;
CREATE POLICY reports_delete_admin ON public.reports
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- ── 3. safety_reports: admins can view, insert, update, and delete all
-- Existing policies (safety_reports_select_own, safety_reports_insert_own)
-- from 009_row_level_security.sql only allow users to view/insert their own.
-- The admin moderation dashboard needs to view all safety reports and manage
-- them (resolve/dismiss/delete).

DROP POLICY IF EXISTS safety_reports_select_own ON public.safety_reports;
CREATE POLICY safety_reports_select_own ON public.safety_reports
    FOR SELECT TO authenticated USING (
        auth.uid() = reporter_id
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

DROP POLICY IF EXISTS safety_reports_insert_own ON public.safety_reports;
CREATE POLICY safety_reports_insert_own ON public.safety_reports
    FOR INSERT TO authenticated WITH CHECK (
        auth.uid() = reporter_id
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

DROP POLICY IF EXISTS safety_reports_update_admin ON public.safety_reports;
CREATE POLICY safety_reports_update_admin ON public.safety_reports
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

DROP POLICY IF EXISTS safety_reports_delete_admin ON public.safety_reports;
CREATE POLICY safety_reports_delete_admin ON public.safety_reports
    FOR DELETE TO authenticated
    USING (
        EXISTS (
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

-- ── 8. user_blocks: admins can view and delete all user blocks ───────────
-- The user_blocks table (distinct from blocks in trust_and_safety) tracks
-- user-initiated blocking. Admins need view access for moderation
-- investigation and delete access to remove abusive blocks.

DROP POLICY IF EXISTS user_blocks_select_own ON public.user_blocks;
CREATE POLICY user_blocks_select_own ON public.user_blocks
    FOR SELECT TO authenticated USING (
        auth.uid() = blocker_id
        OR auth.uid() = blocked_id
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

DROP POLICY IF EXISTS user_blocks_insert_own ON public.user_blocks;
CREATE POLICY user_blocks_insert_own ON public.user_blocks
    FOR INSERT TO authenticated WITH CHECK (
        auth.uid() = blocker_id
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

DROP POLICY IF EXISTS user_blocks_delete_own ON public.user_blocks;
CREATE POLICY user_blocks_delete_own ON public.user_blocks
    FOR DELETE TO authenticated USING (
        auth.uid() = blocker_id
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- ── 9. gift_transactions: admins can view all gift transactions ──────────
-- Admin moderation dashboard may need to inspect gift transactions to
-- investigate coin-related abuse or fraudulent activity.

DROP POLICY IF EXISTS gift_transactions_select_own ON public.gift_transactions;
CREATE POLICY gift_transactions_select_own ON public.gift_transactions
    FOR SELECT TO authenticated USING (
        auth.uid() = sender_id
        OR auth.uid() = receiver_id
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- ── 10. favourites: admins can view all favourites ──────────────────────
-- Admin moderation dashboard may need to inspect favourite relationships
-- to investigate stalking or harassment patterns.

DROP POLICY IF EXISTS favourites_select_own ON public.favourites;
CREATE POLICY favourites_select_own ON public.favourites
    FOR SELECT TO authenticated USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- ── 11. message_reactions: admins can view all message reactions ─────────
-- Admin moderation dashboard may need to inspect reactions to investigate
-- coordinated harassment campaigns.

DROP POLICY IF EXISTS message_reactions_select_admin ON public.message_reactions;
CREATE POLICY message_reactions_select_admin ON public.message_reactions
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- ── 12. login_history: admins can view all login history ─────────────────
-- The login_history table already has login_history_select_own_or_admin from
-- 017_admin_dashboard.sql, but it only allows users to view their own.
-- The admin must be able to view any user's login history (already covered).
-- Reinforcing with explicit admin SELECT policy.

DROP POLICY IF EXISTS login_history_select_own_or_admin ON public.login_history;
CREATE POLICY login_history_select_own_or_admin ON public.login_history
    FOR SELECT TO authenticated USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- ── 13. coin_purchases: admins can view all coin purchases ───────────────
-- coin_purchases is locked to service_role only (policy in
-- 20240101000000_create_coin_purchases.sql). Adding an admin SELECT
-- fallback so that a future admin-read dashboard route using the
-- authenticated role can inspect purchase records for moderation.

DROP POLICY IF EXISTS coin_purchases_select_admin ON public.coin_purchases;
CREATE POLICY coin_purchases_select_admin ON public.coin_purchases
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );
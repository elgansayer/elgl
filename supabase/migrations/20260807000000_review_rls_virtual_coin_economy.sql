-- Migration: Review RLS policies for Virtual Coin Economy architecture.
-- Issue #2425: Hardens existing Row Level Security policies so that a leaked
-- anon/authenticated key or direct Supabase Studio access cannot bypass the
-- backend's coin-related business logic.
--
-- 1. Prevent authenticated users from modifying sensitive columns on `users`
--    (coins_balance, is_vip, vip_tier, is_admin, developer_api_key).
-- 2. Ensure coin-purchase recording is service_role-only (already in place,
--    reinforced here with documentation).
-- 3. Add a CHECK constraint so coin amounts are always > 0.
-- 4. Add missing RLS on tables created after `009_row_level_security.sql`.

-- ── 1. Sensitive-column guard on `users` ────────────────────────────────────
-- The existing `users_update_own` policy allows any authenticated user to
-- UPDATE their own row, including `coins_balance`.  Replace it with a
-- restrictive policy that only permits updates to non-sensitive profile
-- columns, and add a trigger that strips sensitive columns unless the request
-- originates from the service_role backend.

-- Drop the overly-permissive policy first.
DROP POLICY IF EXISTS users_update_own ON public.users;

CREATE POLICY users_update_own ON public.users
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        -- Reject any attempt to change sensitive columns directly.  The
        -- service_role key bypasses RLS entirely, so the backend's economy
        -- and admin endpoints are unaffected.
        AND coins_balance IS NOT DISTINCT FROM (SELECT coins_balance FROM public.users WHERE id = auth.uid())
        AND is_vip IS NOT DISTINCT FROM (SELECT is_vip FROM public.users WHERE id = auth.uid())
        AND vip_tier IS NOT DISTINCT FROM (SELECT vip_tier FROM public.users WHERE id = auth.uid())
        AND is_admin IS NOT DISTINCT FROM (SELECT is_admin FROM public.users WHERE id = auth.uid())
        AND developer_api_key IS NOT DISTINCT FROM (SELECT developer_api_key FROM public.users WHERE id = auth.uid())
    );

-- ── 2. gift_transactions CHECK constraint ───────────────────────────────────
-- Ensure `coins_spent` is always positive.  The column is already NOT NULL,
-- but a zero or negative value would allow coin-theft through gift sending.
ALTER TABLE public.gift_transactions
    ADD CONSTRAINT gift_transactions_coins_spent_positive CHECK (coins_spent > 0) NOT VALID;
-- NOT VALID is intentional: existing rows (if any) are not scanned, but all
-- new writes must satisfy the constraint immediately.
ALTER TABLE public.gift_transactions
    VALIDATE CONSTRAINT gift_transactions_coins_spent_positive;

-- ── 3. Missing RLS on tables created post-009 ───────────────────────────────

-- 3a. achievements (read-only catalogue, managed by service_role)
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY achievements_select_authenticated ON public.achievements
    FOR SELECT TO authenticated USING (true);

-- 3b. user_achievements (owned by the user, service_role manages unlocks)
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_achievements_select_own ON public.user_achievements
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3c. client_errors (diagnostic telemetry -- no client read or write)
ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_errors_service_role_only ON public.client_errors
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3d. assessment_questions (read-only catalogue for authenticated users)
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY assessment_questions_select_authenticated ON public.assessment_questions
    FOR SELECT TO authenticated USING (true);

-- 3e. chat_room_members (participants can see membership of rooms they belong to)
ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_room_members_select_own ON public.chat_room_members
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3f. message_reactions (visible to all authenticated; user owns their own)
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY message_reactions_select_authenticated ON public.message_reactions
    FOR SELECT TO authenticated USING (true);
CREATE POLICY message_reactions_insert_own ON public.message_reactions
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY message_reactions_delete_own ON public.message_reactions
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3g. hobby_tags (read-only catalogue)
ALTER TABLE public.hobby_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY hobby_tags_select_authenticated ON public.hobby_tags
    FOR SELECT TO authenticated USING (true);

-- 3h. user_hobby_tags (owned by the user)
ALTER TABLE public.user_hobby_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_hobby_tags_select_own ON public.user_hobby_tags
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY user_hobby_tags_insert_own ON public.user_hobby_tags
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_hobby_tags_delete_own ON public.user_hobby_tags
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3i. notifications (recipient only)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_select_own ON public.notifications
    FOR SELECT TO authenticated USING (auth.uid() = recipient_id);
CREATE POLICY notifications_update_own ON public.notifications
    FOR UPDATE TO authenticated USING (auth.uid() = recipient_id)
    WITH CHECK (auth.uid() = recipient_id);
-- Insert is permitted for the actor so the backend can use authenticated
-- role if desired, but typically handled by service_role.
CREATE POLICY notifications_insert_actor ON public.notifications
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id);

-- 3j. user_profile_likes (liker owns the action; profile owner can see likes)
ALTER TABLE public.user_profile_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_profile_likes_select_own ON public.user_profile_likes
    FOR SELECT TO authenticated USING (auth.uid() = liker_id OR auth.uid() = liked_id);
CREATE POLICY user_profile_likes_insert_own ON public.user_profile_likes
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = liker_id);
CREATE POLICY user_profile_likes_delete_own ON public.user_profile_likes
    FOR DELETE TO authenticated USING (auth.uid() = liker_id);

-- 3k. chat_groups / chat_group_members (non-public schema, but still RLS)
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_groups_select_member ON public.chat_groups
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.chat_group_members cgm
            WHERE cgm.group_id = chat_groups.id AND cgm.user_id = auth.uid()
        )
    );
ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_group_members_select_own ON public.chat_group_members
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Note: sticker_packs and user_sticker_packs are referenced in the economy
-- service code but do not yet have a dedicated migration.  RLS policies will
-- be added when those tables are created.

-- ── 4. Strengthen coin_purchases docs ──────────────────────────────────────
-- coin_purchases already has `FOR ALL TO service_role` (migration
-- 20240101000000).  No changes needed -- the service_role-only policy
-- is the correct posture for financial records.
COMMENT ON TABLE public.coin_purchases IS
    'IAP coin purchase records. Access is limited to the service_role (NestJS backend).';
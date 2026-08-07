-- Migration: Review RLS policies for Spaced Repetition (SRS) flashcards & decks
-- Fixes #2350: Adds missing RLS policies for decks and deck_flashcards tables,
-- cleans up duplicate flashcards policies left over from 004_flashcards_srs.sql
-- that were superseded by the unified policy in 009_row_level_security.sql,
-- and adds admin-level moderation access consistent with other RLS review
-- migrations (20260807110437_review_rls_admin_moderation.sql).
--
-- The NestJS backend authenticates with the service_role key (bypasses RLS).
-- These policies are defence-in-depth (OWASP A01: Broken Access Control).

-- ── 1. Clean up stale flashcards policies from 004_flashcards_srs.sql ─────
-- 009_row_level_security.sql already added a single "flashcards_all_own"
-- FOR ALL policy.  The four individual policies from 004 are redundant and
-- clutter the policy list.  Drop them so only the clean FOR ALL policy remains.

DROP POLICY IF EXISTS "Users can select their own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can insert their own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can update their own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can delete their own flashcards" ON public.flashcards;

-- Ensure the flashcards_all_own policy from 009 exists (idempotent safety check).
-- If 009 was somehow missed, create it now.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'flashcards'
          AND policyname = 'flashcards_all_own'
    ) THEN
        CREATE POLICY flashcards_all_own ON public.flashcards
            FOR ALL TO authenticated
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- ── 2. decks: RLS policies ───────────────────────────────────────────────
-- The decks table was created via TypeScript migration
-- (20260801000000-create-flashcard-decks.ts) without any RLS policies.
-- Users must own the deck for all operations.

ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS decks_select_own ON public.decks;
CREATE POLICY decks_select_own ON public.decks
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS decks_insert_own ON public.decks;
CREATE POLICY decks_insert_own ON public.decks
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS decks_update_own ON public.decks;
CREATE POLICY decks_update_own ON public.decks
    FOR UPDATE TO authenticated USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS decks_delete_own ON public.decks;
CREATE POLICY decks_delete_own ON public.decks
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── 3. deck_flashcards: RLS policies ─────────────────────────────────────
-- The junction table had no RLS.  Users should only be able to interact with
-- rows belonging to decks they own, which is enforced by requiring the deck
-- to be owned by the authenticated user.

ALTER TABLE public.deck_flashcards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deck_flashcards_select_own ON public.deck_flashcards;
CREATE POLICY deck_flashcards_select_own ON public.deck_flashcards
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.decks d
            WHERE d.id = deck_flashcards.deck_id AND d.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS deck_flashcards_insert_own ON public.deck_flashcards;
CREATE POLICY deck_flashcards_insert_own ON public.deck_flashcards
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.decks d
            WHERE d.id = deck_flashcards.deck_id AND d.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS deck_flashcards_delete_own ON public.deck_flashcards;
CREATE POLICY deck_flashcards_delete_own ON public.deck_flashcards
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.decks d
            WHERE d.id = deck_flashcards.deck_id AND d.user_id = auth.uid()
        )
    );

-- Note: deck_flashcards has no UPDATE policy because rows in this junction
-- table should only be INSERTed or DELETEd (the only meaningful columns are
-- the composite key and added_at timestamp).  An update would never be needed.

-- ── 4. Admin-level access for moderation ──────────────────────────────────
-- Following the pattern established in
-- 20260807110437_review_rls_admin_moderation.sql, admins need read access to
-- all SRS data for moderation investigation (reviewing flashcard content,
-- deck organisation, and abuse patterns).  Admins also need update/delete
-- on flashcards for content moderation (removing inappropriate flashcards).

-- 4a. flashcards: admin SELECT, UPDATE, DELETE policies
DROP POLICY IF EXISTS flashcards_select_admin ON public.flashcards;
CREATE POLICY flashcards_select_admin ON public.flashcards
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

DROP POLICY IF EXISTS flashcards_update_admin ON public.flashcards;
CREATE POLICY flashcards_update_admin ON public.flashcards
    FOR UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

DROP POLICY IF EXISTS flashcards_delete_admin ON public.flashcards;
CREATE POLICY flashcards_delete_admin ON public.flashcards
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- 4b. decks: admin SELECT, DELETE policies (admins can view and remove any deck)
DROP POLICY IF EXISTS decks_select_admin ON public.decks;
CREATE POLICY decks_select_admin ON public.decks
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

DROP POLICY IF EXISTS decks_delete_admin ON public.decks;
CREATE POLICY decks_delete_admin ON public.decks
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- 4c. deck_flashcards: admin SELECT, DELETE policies
DROP POLICY IF EXISTS deck_flashcards_select_admin ON public.deck_flashcards;
CREATE POLICY deck_flashcards_select_admin ON public.deck_flashcards
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

DROP POLICY IF EXISTS deck_flashcards_delete_admin ON public.deck_flashcards;
CREATE POLICY deck_flashcards_delete_admin ON public.deck_flashcards
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );
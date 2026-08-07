-- Migration: Review RLS policies for Matchmaking Algorithm
-- Fixes #2299: Adds missing Row Level Security policies for tables used by the
-- matchmaking / discovery / recommendations architecture.
--
-- The NestJS backend authenticates with the service_role key (bypasses RLS).
-- These policies are defence-in-depth (OWASP A01: Broken Access Control).

-- ── 1. user_interests: RLS policies ───────────────────────────────────────
-- Used by recommendations.service.ts and interests.service.ts for
-- interest-based partner matching.  Users own their interest tags.

ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_interests_select_own ON public.user_interests
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY user_interests_insert_own ON public.user_interests
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_interests_delete_own ON public.user_interests
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- No UPDATE policy -- rows in this table only need INSERT/DELETE.
-- The (user_id, tag) UNIQUE constraint ensures idempotent inserts.

-- ── 2. interest_vocabulary: RLS policies ──────────────────────────────────
-- Read-only catalogue of vocabulary words linked to interest tags.
-- Managed by the service_role backend; authenticated users may only read.

ALTER TABLE public.interest_vocabulary ENABLE ROW LEVEL SECURITY;

CREATE POLICY interest_vocabulary_select_authenticated ON public.interest_vocabulary
    FOR SELECT TO authenticated USING (true);

-- ── 3. Search function security review ─────────────────────────────────────
-- search_nearby_users is declared SECURITY DEFINER so it runs with the
-- privileges of the function owner (postgres), bypassing RLS.  This is
-- intentional: the function filters by privacy_hide_from_search and only
-- exposes public profile fields.  The discovery service further applies
-- block-list filtering, VIP spoofing, and advanced filter logic server-side.
-- No changes needed for the function itself.

COMMENT ON FUNCTION public.search_nearby_users IS
    'SECURITY DEFINER -- bypasses RLS to perform efficient PostGIS proximity filtering.  The discovery service applies additional access-control (blocks, privacy) server-side.';

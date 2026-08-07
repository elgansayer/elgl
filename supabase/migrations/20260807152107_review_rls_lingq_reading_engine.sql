-- Migration: Review RLS policies for LingQ Reading Engine (curated articles & dialogues)
-- Fixes #2324: Adds RLS policies on curated_articles and curated_dialogues tables.
--
-- The NestJS backend authenticates with the service_role key (bypasses RLS).
-- These policies are defence-in-depth (OWASP A01: Broken Access Control) so that
-- a leaked anon/authenticated key or direct Supabase Studio access cannot
-- bypass the backend's content management logic.
--
-- The curated_articles and curated_dialogues tables were created via TypeScript
-- migrations (20260731000003-create-curated-content.ts and
-- 002_create_curated_learning_tables.sql) without any RLS policies in the
-- Supabase migrations directory.

-- ── 1. curated_articles: read-only catalogue for authenticated users ────
-- Articles are curated reading content (like LingQ's library).  End users
-- browse them via the CuratedContentController GET endpoints.  Only the
-- backend (service_role) may INSERT, UPDATE, or DELETE rows.

ALTER TABLE public.curated_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY curated_articles_select_authenticated ON public.curated_articles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY curated_articles_insert_service_role ON public.curated_articles
    FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY curated_articles_update_service_role ON public.curated_articles
    FOR UPDATE TO service_role USING (true) WITH CHECK (true);

CREATE POLICY curated_articles_delete_service_role ON public.curated_articles
    FOR DELETE TO service_role USING (true);

-- ── 2. curated_dialogues: read-only catalogue for authenticated users ────
-- Dialogues are curated scripted conversations.  Same access pattern as
-- curated_articles above.

ALTER TABLE public.curated_dialogues ENABLE ROW LEVEL SECURITY;

CREATE POLICY curated_dialogues_select_authenticated ON public.curated_dialogues
    FOR SELECT TO authenticated USING (true);

CREATE POLICY curated_dialogues_insert_service_role ON public.curated_dialogues
    FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY curated_dialogues_update_service_role ON public.curated_dialogues
    FOR UPDATE TO service_role USING (true) WITH CHECK (true);

CREATE POLICY curated_dialogues_delete_service_role ON public.curated_dialogues
    FOR DELETE TO service_role USING (true);
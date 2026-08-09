-- Migration: Review RLS policies for LingQ Reading Engine
-- Fixes #2324: Adds missing Row Level Security policies for curated_articles
-- and curated_dialogues tables (the LQ-style interactive reading engine).
--
-- The NestJS backend authenticates with the service_role key (bypasses RLS).
-- These policies are defence-in-depth (OWASP A01: Broken Access Control) so
-- that a leaked anon/authenticated key or direct Supabase Studio access cannot
-- mutate the reading catalogue without admin privileges.

-- ── 1. curated_articles: read-only catalogue for all authenticated users; ──
--    only admins may insert, update, or delete rows via the authenticated role.

ALTER TABLE public.curated_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY curated_articles_select_authenticated ON public.curated_articles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY curated_articles_insert_admin ON public.curated_articles
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

CREATE POLICY curated_articles_update_admin ON public.curated_articles
    FOR UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

CREATE POLICY curated_articles_delete_admin ON public.curated_articles
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- ── 2. curated_dialogues: read-only catalogue for all authenticated users; ──
--    only admins may insert, update, or delete rows via the authenticated role.

ALTER TABLE public.curated_dialogues ENABLE ROW LEVEL SECURITY;

CREATE POLICY curated_dialogues_select_authenticated ON public.curated_dialogues
    FOR SELECT TO authenticated USING (true);

CREATE POLICY curated_dialogues_insert_admin ON public.curated_dialogues
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

CREATE POLICY curated_dialogues_update_admin ON public.curated_dialogues
    FOR UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

CREATE POLICY curated_dialogues_delete_admin ON public.curated_dialogues
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );
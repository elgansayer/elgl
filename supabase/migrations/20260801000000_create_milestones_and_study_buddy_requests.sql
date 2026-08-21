-- Milestone tracking and study buddy matching tables
-- Created 2026-08-01

CREATE TABLE IF NOT EXISTS public.milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS milestones_user_id_idx ON public.milestones (user_id);

CREATE TABLE IF NOT EXISTS public.study_buddy_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    partner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT study_buddy_requests_no_self CHECK (requester_id <> partner_id),
    UNIQUE (requester_id, partner_id)
);

CREATE INDEX IF NOT EXISTS study_buddy_requests_requester_idx ON public.study_buddy_requests (requester_id);
CREATE INDEX IF NOT EXISTS study_buddy_requests_partner_idx ON public.study_buddy_requests (partner_id);

-- Row Level Security (defence-in-depth; the NestJS backend uses the
-- service_role key which bypasses RLS, see 009_row_level_security.sql).
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY milestones_select_own ON public.milestones
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY milestones_insert_own ON public.milestones
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY milestones_update_own ON public.milestones
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY milestones_delete_own ON public.milestones
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.study_buddy_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY study_buddy_requests_select_own ON public.study_buddy_requests
    FOR SELECT TO authenticated USING (auth.uid() = requester_id OR auth.uid() = partner_id);
CREATE POLICY study_buddy_requests_insert_own ON public.study_buddy_requests
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);
CREATE POLICY study_buddy_requests_update_participant ON public.study_buddy_requests
    FOR UPDATE TO authenticated USING (auth.uid() = requester_id OR auth.uid() = partner_id);

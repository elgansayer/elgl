-- Admin Portal: user management (Phase 50)
-- Adds an is_admin flag for gating the admin API/UI, plus a login_history
-- table so admins can inspect when and from where a user last authenticated.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON public.users(is_admin) WHERE is_admin = true;

CREATE TABLE IF NOT EXISTS public.login_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    ip_address VARCHAR(64) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_history_user_id_created_at
    ON public.login_history(user_id, created_at DESC);

-- Defence-in-depth RLS: the NestJS backend authenticates with the
-- service_role key (bypasses RLS); these policies only protect against a
-- leaked anon/authenticated key or direct Supabase Studio access.
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY login_history_select_own_or_admin ON public.login_history
    FOR SELECT TO authenticated USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );
CREATE POLICY login_history_insert_own ON public.login_history
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

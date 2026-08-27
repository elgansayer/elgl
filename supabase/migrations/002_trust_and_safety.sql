-- Create profile_visits table ("Who Viewed Me")
CREATE TABLE IF NOT EXISTS public.profile_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visitor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    viewed_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_visits_viewed_id_idx ON public.profile_visits (viewed_id, created_at DESC);
CREATE INDEX IF NOT EXISTS profile_visits_visitor_id_idx ON public.profile_visits (visitor_id);

-- Create blocks table
CREATE TABLE IF NOT EXISTS public.blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blocker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_block UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS blocks_blocker_id_idx ON public.blocks (blocker_id);
CREATE INDEX IF NOT EXISTS blocks_blocked_id_idx ON public.blocks (blocked_id);

-- Create reports table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reported_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reason_category VARCHAR(100) NOT NULL,
    description TEXT,
    context_url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_reported_user_id_idx ON public.reports (reported_user_id);
CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports (status);

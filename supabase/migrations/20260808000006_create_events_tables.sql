-- Migration: Create events, event_rsvps, and event_reminders_sent tables
-- Supports automated push notification reminders for language learning events

CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    date_time TIMESTAMPTZ NOT NULL,
    location TEXT,
    language_pair TEXT,
    max_participants INTEGER,
    host_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    proficiency TEXT,
    is_cancelled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_date_time_idx ON public.events (date_time);
CREATE INDEX IF NOT EXISTS events_host_id_idx ON public.events (host_id);
CREATE INDEX IF NOT EXISTS events_language_pair_idx ON public.events (language_pair);
CREATE INDEX IF NOT EXISTS events_category_idx ON public.events (category);

CREATE TABLE IF NOT EXISTS public.event_rsvps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('attending', 'interested')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_rsvps_event_id_idx ON public.event_rsvps (event_id);
CREATE INDEX IF NOT EXISTS event_rsvps_user_id_idx ON public.event_rsvps (user_id);
CREATE INDEX IF NOT EXISTS event_rsvps_status_idx ON public.event_rsvps (status);

CREATE TABLE IF NOT EXISTS public.event_reminders_sent (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_reminders_sent_event_id_idx
    ON public.event_reminders_sent (event_id);

-- RLS: Enable row-level security
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_reminders_sent ENABLE ROW LEVEL SECURITY;

-- RLS policies for events: anyone authenticated can view events
CREATE POLICY "Authenticated users can view events"
    ON public.events FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Host can insert events"
    ON public.events FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host can update their own events"
    ON public.events FOR UPDATE
    TO authenticated
    USING (auth.uid() = host_id);

CREATE POLICY "Host can delete their own events"
    ON public.events FOR DELETE
    TO authenticated
    USING (auth.uid() = host_id);

-- RLS policies for event_rsvps
CREATE POLICY "Users can view their own RSVPs"
    ON public.event_rsvps FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own RSVPs"
    ON public.event_rsvps FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own RSVPs"
    ON public.event_rsvps FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own RSVPs"
    ON public.event_rsvps FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- RLS policies for event_reminders_sent (system-managed, no direct user access)
CREATE POLICY "Users can view their own sent reminders"
    ON public.event_reminders_sent FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Allow service_role full access for background jobs
CREATE POLICY "Service role full access to reminders"
    ON public.event_reminders_sent FOR INSERT
    TO service_role
    WITH CHECK (true);
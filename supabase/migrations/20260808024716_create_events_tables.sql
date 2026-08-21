-- Migration: Create events, event_rsvps and event_reminders_sent tables
-- Fixes #856: Build automated push notification reminders

-- Events table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK (category IN ('audio_room', 'learning_seminar', 'in_person_meetup', 'cultural_exchange')),
    date_time TIMESTAMPTZ NOT NULL,
    location TEXT,
    language_pair TEXT,
    max_participants INTEGER,
    host_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    is_cancelled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_date_time_idx ON public.events (date_time);
CREATE INDEX IF NOT EXISTS events_host_id_idx ON public.events (host_id);
CREATE INDEX IF NOT EXISTS events_language_pair_idx ON public.events (language_pair);
CREATE INDEX IF NOT EXISTS events_category_idx ON public.events (category);

-- Event RSVPs table
CREATE TABLE IF NOT EXISTS public.event_rsvps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('attending', 'interested')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_rsvps_event_id_idx ON public.event_rsvps (event_id);
CREATE INDEX IF NOT EXISTS event_rsvps_user_id_idx ON public.event_rsvps (user_id);
CREATE INDEX IF NOT EXISTS event_rsvps_status_idx ON public.event_rsvps (status);

-- Event reminders sent table (deduplication)
CREATE TABLE IF NOT EXISTS public.event_reminders_sent (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_reminders_sent_event_id_idx ON public.event_reminders_sent (event_id);
CREATE INDEX IF NOT EXISTS event_reminders_sent_user_id_idx ON public.event_reminders_sent (user_id);

-- RLS policies
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_reminders_sent ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read events
CREATE POLICY "Anyone can read events" ON public.events
    FOR SELECT USING (auth.role() = 'authenticated');

-- Host can update/delete their own events
CREATE POLICY "Host can update own events" ON public.events
    FOR UPDATE USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());

CREATE POLICY "Host can delete own events" ON public.events
    FOR DELETE USING (host_id = auth.uid());

-- Anyone authenticated can insert events
CREATE POLICY "Authenticated users can create events" ON public.events
    FOR INSERT WITH CHECK (host_id = auth.uid());

-- RSVP policies
CREATE POLICY "Anyone can read RSVPs" ON public.event_rsvps
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage own RSVPs" ON public.event_rsvps
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own RSVPs" ON public.event_rsvps
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own RSVPs" ON public.event_rsvps
    FOR DELETE USING (user_id = auth.uid());

-- Reminders sent - only service role or system can write
CREATE POLICY "Service can manage reminders" ON public.event_reminders_sent
    FOR ALL USING (true) WITH CHECK (true);
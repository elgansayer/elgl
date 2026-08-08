-- Create events and event_rsvps tables for language exchange events

CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK (category IN ('audio_room', 'learning_seminar', 'in_person_meetup', 'cultural_exchange')),
    date_time TIMESTAMPTZ NOT NULL,
    location TEXT,
    language_pair TEXT,
    max_participants INTEGER CHECK (max_participants > 0 AND max_participants <= 100),
    proficiency TEXT CHECK (proficiency IN ('Beginner', 'Intermediate', 'Advanced')),
    host_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    is_cancelled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_date_time_idx ON public.events (date_time);
CREATE INDEX IF NOT EXISTS events_host_id_idx ON public.events (host_id);
CREATE INDEX IF NOT EXISTS events_category_idx ON public.events (category);
CREATE INDEX IF NOT EXISTS events_language_pair_idx ON public.events (language_pair);
CREATE INDEX IF NOT EXISTS events_proficiency_idx ON public.events (proficiency);

CREATE TABLE IF NOT EXISTS public.event_rsvps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('attending', 'interested')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_rsvps_event_id_idx ON public.event_rsvps (event_id);
CREATE INDEX IF NOT EXISTS event_rsvps_user_id_idx ON public.event_rsvps (user_id);
CREATE INDEX IF NOT EXISTS event_rsvps_status_idx ON public.event_rsvps (status);

CREATE TABLE IF NOT EXISTS public.event_reminders_sent (
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_reminders_sent ENABLE ROW LEVEL SECURITY;

-- Events: anyone authenticated can read, host can insert/update
CREATE POLICY "Anyone can read events" ON public.events
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create events" ON public.events
    FOR INSERT WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host can update own events" ON public.events
    FOR UPDATE USING (auth.uid() = host_id);

CREATE POLICY "Host can delete own events" ON public.events
    FOR DELETE USING (auth.uid() = host_id);

-- Event RSVPs: users can read all, manage own
CREATE POLICY "Anyone can read RSVPs" ON public.event_rsvps
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create own RSVPs" ON public.event_rsvps
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own RSVPs" ON public.event_rsvps
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own RSVPs" ON public.event_rsvps
    FOR DELETE USING (auth.uid() = user_id);

-- Event reminders sent: service role only
CREATE POLICY "Service role can manage reminders" ON public.event_reminders_sent
    FOR ALL USING (true);
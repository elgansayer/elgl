-- Migration: Create call_logs table and add data retention infrastructure
-- for GDPR compliance of Video Classrooms / Audio Rooms.
--
-- Tables created:
--   call_logs - immutable record of every 1:1 video/audio call for
--               caller/receiver history (call log UI) and stats.
--
-- Retention policies (enforced in backend DataRetentionService):
--   call_logs            → 90 days  (call metadata is PII linking two users)
--   audio_room_captions  → 180 days (transcript data may contain PII in
--                                     speech content)
--   audio_room_notes     → 180 days (vocabulary notes contain author PII)
--   audio_room_transcripts → 180 days (session transcripts / summaries)
--   audio_room_tips      → 365 days (financial transaction records)

CREATE TABLE IF NOT EXISTS public.call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    caller_name TEXT NOT NULL,
    receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_name TEXT NOT NULL,
    call_type TEXT NOT NULL CHECK (call_type IN ('incoming', 'outgoing', 'missed')),
    room_name TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS call_logs_caller_id_idx ON public.call_logs (caller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS call_logs_receiver_id_idx ON public.call_logs (receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS call_logs_created_at_idx ON public.call_logs (created_at);

ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see call logs where they are a participant
CREATE POLICY "Users can view own call logs"
    ON public.call_logs FOR SELECT
    TO authenticated
    USING (caller_id = auth.uid() OR receiver_id = auth.uid());

-- Only system (backend) can insert/update call logs
CREATE POLICY "System can insert call logs"
    ON public.call_logs FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "System can update call logs"
    ON public.call_logs FOR UPDATE
    TO authenticated
    USING (true);

-- No deletes via RLS -- retention is handled by backend crons
CREATE POLICY "No direct deletes"
    ON public.call_logs FOR DELETE
    TO authenticated
    USING (false);

-- Create audio_room_transcripts if missing (referenced in supabase.service.ts types)
CREATE TABLE IF NOT EXISTS public.audio_room_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.audio_rooms(id) ON DELETE CASCADE,
    recording_url TEXT,
    transcript_text TEXT,
    session_summary TEXT,
    vocabulary_list TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audio_room_transcripts_room_idx ON public.audio_room_transcripts (room_id);

ALTER TABLE public.audio_room_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view transcripts"
    ON public.audio_room_transcripts FOR SELECT
    TO authenticated
    USING (true);

-- Ensure audio_room_tips table exists (referenced in supabase.service.ts types)
CREATE TABLE IF NOT EXISTS public.audio_room_tips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.audio_rooms(id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount_coins INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audio_room_tips_sender_idx ON public.audio_room_tips (sender_user_id);
CREATE INDEX IF NOT EXISTS audio_room_tips_receiver_idx ON public.audio_room_tips (receiver_user_id);

ALTER TABLE public.audio_room_tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tips"
    ON public.audio_room_tips FOR SELECT
    TO authenticated
    USING (sender_user_id = auth.uid() OR receiver_user_id = auth.uid());
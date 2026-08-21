-- Migration: Optimise database indices (PostgreSQL) and query performance
-- for Video Classrooms
-- Fixes #2242
--
-- Video classroom query patterns that benefit from these indices:
--   1. listActiveRooms:  SELECT ... FROM audio_rooms WHERE is_active=true
--                         [AND party_type=?] [AND topic_tag=?] [AND level=?]
--                         ORDER BY created_at DESC
--   2. getCallLogs:      SELECT ... FROM call_logs
--                         WHERE caller_id=? OR receiver_id=?
--                         [AND call_type=?] ORDER BY started_at DESC
--   3. tipHost:          SELECT/INSERT on audio_room_tips (room_id, sender_user_id)
--   4. createPoll:       INSERT on quick_polls (room_id, host_id)
--   5. getPollResults:   SELECT from quick_polls + poll_votes (poll_id)
--   6. getTranscript:    SELECT from audio_room_transcripts (room_id)
--   7. host-dashboard:   SELECT from audio_rooms (id) for participants_count
--   8. Video stream filter: WHERE is_video_stream=true on audio_rooms

-- ══════════════════════════════════════════════════════════════════════════
-- SECTION 1: call_logs table (missing table)
-- ══════════════════════════════════════════════════════════════════════════
-- Used by calls.service.ts and audio-rooms.service.ts for tracking
-- call history (VOIP video/audio calls between users).
CREATE TABLE IF NOT EXISTS public.call_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    caller_name TEXT NOT NULL DEFAULT '',
    receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_name TEXT NOT NULL DEFAULT '',
    call_type VARCHAR(20) NOT NULL DEFAULT 'outgoing'
        CHECK (call_type IN ('incoming', 'outgoing', 'missed')),
    room_name TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Compound index: query by caller_id ordered by started_at DESC
CREATE INDEX IF NOT EXISTS idx_call_logs_caller_started
    ON public.call_logs (caller_id, started_at DESC);

-- Compound index: query by receiver_id ordered by started_at DESC
CREATE INDEX IF NOT EXISTS idx_call_logs_receiver_started
    ON public.call_logs (receiver_id, started_at DESC);

-- Partial index: missed calls for a single user (caller or receiver)
CREATE INDEX IF NOT EXISTS idx_call_logs_caller_type_started
    ON public.call_logs (caller_id, call_type, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_logs_receiver_type_started
    ON public.call_logs (receiver_id, call_type, started_at DESC);

ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY call_logs_select_own ON public.call_logs
    FOR SELECT TO authenticated
    USING (caller_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY call_logs_insert_own ON public.call_logs
    FOR INSERT TO authenticated
    WITH CHECK (caller_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════════════
-- SECTION 2: audio_room_tips table (missing table)
-- ══════════════════════════════════════════════════════════════════════════
-- Used by audio-rooms.service.ts tipHost() for host tipping in voice/video rooms.
CREATE TABLE IF NOT EXISTS public.audio_room_tips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.audio_rooms(id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount_coins INTEGER NOT NULL CHECK (amount_coins > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index: look up tips for a room ordered by recency
CREATE INDEX IF NOT EXISTS idx_audio_room_tips_room_created
    ON public.audio_room_tips (room_id, created_at DESC);

-- Index: look up tips sent by a user
CREATE INDEX IF NOT EXISTS idx_audio_room_tips_sender_created
    ON public.audio_room_tips (sender_user_id, created_at DESC);

-- Index: look up tips received by a host
CREATE INDEX IF NOT EXISTS idx_audio_room_tips_receiver_created
    ON public.audio_room_tips (receiver_user_id, created_at DESC);

ALTER TABLE public.audio_room_tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY audio_room_tips_select_own ON public.audio_room_tips
    FOR SELECT TO authenticated
    USING (
        sender_user_id = auth.uid()
        OR receiver_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.audio_rooms ar
            WHERE ar.id = room_id
        )
    );

CREATE POLICY audio_room_tips_insert_own ON public.audio_room_tips
    FOR INSERT TO authenticated
    WITH CHECK (sender_user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════════════
-- SECTION 3: audio_rooms performance indices for video classrooms
-- ══════════════════════════════════════════════════════════════════════════

-- listActiveRooms: filtered by is_active + topic_tag/party_type/level
-- and ordered by created_at DESC. This composite index replaces the simple
-- `audio_rooms_active_idx` for the common public listing query path.
CREATE INDEX IF NOT EXISTS idx_audio_rooms_active_created
    ON public.audio_rooms (is_active, created_at DESC)
    WHERE is_active = true;

-- Party type filtering (language_party / standard room)
CREATE INDEX IF NOT EXISTS idx_audio_rooms_party_type_active
    ON public.audio_rooms (party_type, is_active, created_at DESC)
    WHERE party_type IS NOT NULL;

-- Topic tag filtering for active rooms
CREATE INDEX IF NOT EXISTS idx_audio_rooms_topic_active
    ON public.audio_rooms (topic_tag, is_active, created_at DESC)
    WHERE topic_tag IS NOT NULL;

-- Level filtering for active rooms
CREATE INDEX IF NOT EXISTS idx_audio_rooms_level_active
    ON public.audio_rooms (level, is_active, created_at DESC)
    WHERE level IS NOT NULL;

-- Video stream discovery: find active video-enabled classrooms
CREATE INDEX IF NOT EXISTS idx_audio_rooms_video_active
    ON public.audio_rooms (is_video_stream, is_active, created_at DESC)
    WHERE is_video_stream = true;

-- Host dashboard: lookup rooms by host for dashboard stats
CREATE INDEX IF NOT EXISTS idx_audio_rooms_host_active
    ON public.audio_rooms (host_id, is_active, created_at DESC);

-- Target language discovery
CREATE INDEX IF NOT EXISTS idx_audio_rooms_language_active
    ON public.audio_rooms (target_language, is_active, created_at DESC);

-- ══════════════════════════════════════════════════════════════════════════
-- SECTION 4: quick_polls and poll_votes optimization
-- ══════════════════════════════════════════════════════════════════════════

-- Active polls for a room (most common query for poll listing)
CREATE INDEX IF NOT EXISTS idx_quick_polls_room_active
    ON public.quick_polls (room_id, is_active DESC, created_at DESC);

-- Poll votes: compound index for getPollResults which counts votes per poll
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_option
    ON public.poll_votes (poll_id, option_index);

-- ══════════════════════════════════════════════════════════════════════════
-- SECTION 5: audio_room_transcripts optimization
-- ══════════════════════════════════════════════════════════════════════════

-- getTranscript queries by room_id ordered by created_at DESC with LIMIT 1
CREATE INDEX IF NOT EXISTS idx_audio_room_transcripts_room_created
    ON public.audio_room_transcripts (room_id, created_at DESC);
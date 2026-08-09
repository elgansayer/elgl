-- Migration: Review RLS policies for Video Classrooms (Audio Rooms + LiveKit)
-- Fixes #2249: Comprehensive Row Level Security review and hardening for all
-- tables used by the video classrooms / audio rooms subsystem.
--
-- The NestJS backend authenticates with the service_role key (bypasses RLS).
-- These policies are defence-in-depth (OWASP A01: Broken Access Control).

-- ── 1. audio_rooms: add DELETE policy, expand UPDATE to co-host ──────────
-- Existing policies from 009_row_level_security.sql:
--   audio_rooms_select_authenticated (SELECT for any authenticated user)
--   audio_rooms_insert_own (INSERT for host only)
--   audio_rooms_update_own (UPDATE for host only -- too narrow)
-- Missing:
--   * DELETE: host should be able to delete their own room
--   * UPDATE should also allow co_host to update room state (approve speakers,
--     raise hands, archive, etc. -- see AudioRoomsService)

DROP POLICY IF EXISTS audio_rooms_update_own ON public.audio_rooms;
CREATE POLICY audio_rooms_update_own ON public.audio_rooms
    FOR UPDATE TO authenticated USING (
        auth.uid() = host_id
        OR auth.uid() = co_host_id
    ) WITH CHECK (
        auth.uid() = host_id
        OR auth.uid() = co_host_id
    );

DROP POLICY IF EXISTS audio_rooms_delete_own ON public.audio_rooms;
CREATE POLICY audio_rooms_delete_own ON public.audio_rooms
    FOR DELETE TO authenticated USING (auth.uid() = host_id);

-- ── 2. audio_room_captions: add DELETE policy ────────────────────────────
-- Existing policies from 009: SELECT (any auth), INSERT (own captions only).
-- Missing: DELETE.  The host, co-host, and caption author should be able to
-- remove captions (e.g. for moderation of inappropriate auto-captions).

DROP POLICY IF EXISTS audio_room_captions_delete_own ON public.audio_room_captions;
CREATE POLICY audio_room_captions_delete_own ON public.audio_room_captions
    FOR DELETE TO authenticated USING (
        auth.uid() = speaker_id
        OR EXISTS (
            SELECT 1 FROM public.audio_rooms ar
            WHERE ar.id = audio_room_captions.room_id
              AND (ar.host_id = auth.uid() OR ar.co_host_id = auth.uid())
        )
    );

-- ── 3. audio_room_transcripts: RLS policies ──────────────────────────────
-- Created via backend SQL migration (002_add_audio_rooms_transcript.sql);
-- no RLS has been applied.  Everyone in the room can read the transcript;
-- only the host can archive/upsert a transcript.

ALTER TABLE public.audio_room_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY audio_room_transcripts_select_authenticated
    ON public.audio_room_transcripts
    FOR SELECT TO authenticated USING (true);

-- INSERT/UPDATE only for the room host (the backend service handles this
-- via service_role, but policy adds defence-in-depth).
CREATE POLICY audio_room_transcripts_insert_own
    ON public.audio_room_transcripts
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.audio_rooms ar
            WHERE ar.id = audio_room_transcripts.room_id
              AND ar.host_id = auth.uid()
        )
    );

CREATE POLICY audio_room_transcripts_update_own
    ON public.audio_room_transcripts
    FOR UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.audio_rooms ar
            WHERE ar.id = audio_room_transcripts.room_id
              AND ar.host_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.audio_rooms ar
            WHERE ar.id = audio_room_transcripts.room_id
              AND ar.host_id = auth.uid()
        )
    );

-- ── 4. audio_room_tips: create table + RLS policies ──────────────────────
-- This table is referenced extensively in AudioRoomsService.tipHost() but
-- no migration has been created for it.  The service inserts and reads from
-- this table with the service_role, but we need the table and RLS for
-- defence-in-depth.

CREATE TABLE IF NOT EXISTS public.audio_room_tips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.audio_rooms(id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount_coins INTEGER NOT NULL CHECK (amount_coins > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audio_room_tips_room_id
    ON public.audio_room_tips (room_id);
CREATE INDEX IF NOT EXISTS idx_audio_room_tips_sender
    ON public.audio_room_tips (sender_user_id);
CREATE INDEX IF NOT EXISTS idx_audio_room_tips_receiver
    ON public.audio_room_tips (receiver_user_id);

ALTER TABLE public.audio_room_tips ENABLE ROW LEVEL SECURITY;

-- Senders and receivers can see their own tip transactions.
CREATE POLICY audio_room_tips_select_own
    ON public.audio_room_tips
    FOR SELECT TO authenticated USING (
        auth.uid() = sender_user_id OR auth.uid() = receiver_user_id
    );

-- Only the sender can insert a tip (prevent forged tips from other users).
CREATE POLICY audio_room_tips_insert_own
    ON public.audio_room_tips
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_user_id);

-- ── 5. call_logs: create table + RLS policies ────────────────────────────
-- Used by AudioRoomsService.getCallLogs() and StatsService.  No migration
-- currently exists, but the service code reads and writes this table.

CREATE TABLE IF NOT EXISTS public.call_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    caller_name VARCHAR(255) NOT NULL DEFAULT 'Unknown',
    receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_name VARCHAR(255) NOT NULL DEFAULT 'Unknown',
    call_type VARCHAR(20) NOT NULL DEFAULT 'outgoing'
        CHECK (call_type IN ('incoming', 'outgoing', 'missed')),
    room_name VARCHAR(255) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_caller_id
    ON public.call_logs (caller_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_receiver_id
    ON public.call_logs (receiver_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_started_at
    ON public.call_logs (started_at DESC);

ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- Users can see their own call logs (as caller or receiver).
CREATE POLICY call_logs_select_own
    ON public.call_logs
    FOR SELECT TO authenticated USING (
        auth.uid() = caller_id OR auth.uid() = receiver_id
    );

-- Users record calls they initiate; the backend uses service_role for all
-- mutations, but this policy is defence-in-depth.
CREATE POLICY call_logs_insert_own
    ON public.call_logs
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = caller_id);

-- ── 6. quick_polls: RLS policies ─────────────────────────────────────────
-- Created via TypeORM migration (20260730000001-create-quick-polls.ts)
-- without RLS.  The host can manage polls; any participant can read.

ALTER TABLE public.quick_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY quick_polls_select_authenticated
    ON public.quick_polls
    FOR SELECT TO authenticated USING (true);

CREATE POLICY quick_polls_insert_own
    ON public.quick_polls
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);

CREATE POLICY quick_polls_update_own
    ON public.quick_polls
    FOR UPDATE TO authenticated USING (auth.uid() = host_id)
    WITH CHECK (auth.uid() = host_id);

CREATE POLICY quick_polls_delete_own
    ON public.quick_polls
    FOR DELETE TO authenticated USING (auth.uid() = host_id);

-- ── 7. poll_votes: RLS policies ─────────────────────────────────────────
-- Created via TypeORM migration (20260730000001-create-quick-polls.ts)
-- without RLS.  One vote per user per poll (enforced by UNIQUE constraint).
-- Votes are visible to everyone in the room (for live results).

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY poll_votes_select_authenticated
    ON public.poll_votes
    FOR SELECT TO authenticated USING (true);

CREATE POLICY poll_votes_insert_own
    ON public.poll_votes
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users cannot update or delete votes once cast (polls are immutable).
-- Only the service_role can remove votes if needed.

-- ── 8. Admin-level access for audit / moderation ─────────────────────────
-- Following the pattern established in
-- 20260807110437_review_rls_admin_moderation.sql, admins need read access
-- to all video-classroom-related tables for moderation investigation
-- (reviewing call logs, tip flows, poll activity, and transcripts).

DROP POLICY IF EXISTS audio_room_tips_select_admin ON public.audio_room_tips;
CREATE POLICY audio_room_tips_select_admin ON public.audio_room_tips
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

DROP POLICY IF EXISTS call_logs_select_admin ON public.call_logs;
CREATE POLICY call_logs_select_admin ON public.call_logs
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

DROP POLICY IF EXISTS quick_polls_select_admin ON public.quick_polls;
CREATE POLICY quick_polls_select_admin ON public.quick_polls
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

DROP POLICY IF EXISTS poll_votes_select_admin ON public.poll_votes;
CREATE POLICY poll_votes_select_admin ON public.poll_votes
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

DROP POLICY IF EXISTS audio_room_transcripts_select_admin
    ON public.audio_room_transcripts;
CREATE POLICY audio_room_transcripts_select_admin
    ON public.audio_room_transcripts
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

DROP POLICY IF EXISTS audio_rooms_delete_admin ON public.audio_rooms;
CREATE POLICY audio_rooms_delete_admin ON public.audio_rooms
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

DROP POLICY IF EXISTS audio_room_captions_delete_admin
    ON public.audio_room_captions;
CREATE POLICY audio_room_captions_delete_admin ON public.audio_room_captions
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );
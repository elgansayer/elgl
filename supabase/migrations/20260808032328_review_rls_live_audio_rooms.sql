-- Migration: Review RLS policies for Live Audio Rooms
-- Fixes #2224: Comprehensive Row Level Security review for all tables
-- used by the Live Audio Rooms architecture.
--
-- The NestJS backend authenticates with the service_role key (bypasses RLS).
-- These policies are defence-in-depth (OWASP A01: Broken Access Control).
--
-- Previous audio rooms RLS coverage:
--   009_row_level_security.sql          : base SELECT/INSERT/UPDATE for audio_rooms & captions
--   20260807000001_create_audio_room_notes.sql : notes RLS (SELECT/INSERT/DELETE)
--   20260807190000_review_rls_video_classrooms.sql (#2249) : extended RLS for video classrooms
--
-- Gaps addressed in this review:
--   1. audio_rooms: private room SELECT leak -- all auth users can list private rooms
--   2. audio_rooms: archived rooms should be immutable through UPDATE
--   3. audio_room_notes: missing admin SELECT (all other tables have it)
--   4. audio_room_notes: co-host cannot delete notes
--   5. audio_room_notes: no UPDATE policy (author only)
--   6. audio_room_notes: no admin DELETE for moderation
--   7. audio_room_tips: no DELETE policy
--   8. call_logs: no DELETE policy
--   9. audio_room_captions: no UPDATE policy

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. audio_rooms: tighten SELECT to exclude private rooms from public listing
-- ═══════════════════════════════════════════════════════════════════════════
-- The existing audio_rooms_select_authenticated allows any authenticated user
-- to read all audio_rooms regardless of is_private.  Private rooms should
-- only be visible to the host, co-host, and invited users.

DROP POLICY IF EXISTS audio_rooms_select_authenticated ON public.audio_rooms;
CREATE POLICY audio_rooms_select_authenticated ON public.audio_rooms
    FOR SELECT TO authenticated USING (
        is_private IS NULL
        OR is_private = false
        OR auth.uid() = host_id
        OR auth.uid() = co_host_id
        OR invited_user_ids IS NOT NULL AND auth.uid() = ANY (invited_user_ids)
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. audio_rooms: block UPDATE on archived rooms
-- ═══════════════════════════════════════════════════════════════════════════
-- Once a room is archived (is_archived = true), mutations must go through
-- the backend service_role exclusively.  This prevents stale clients or
-- race conditions from re-activating archived rooms.

DROP POLICY IF EXISTS audio_rooms_update_own ON public.audio_rooms;
CREATE POLICY audio_rooms_update_own ON public.audio_rooms
    FOR UPDATE TO authenticated USING (
        (auth.uid() = host_id OR auth.uid() = co_host_id)
        AND (is_archived IS NULL OR is_archived = false)
    ) WITH CHECK (
        (auth.uid() = host_id OR auth.uid() = co_host_id)
        AND (is_archived IS NULL OR is_archived = false)
    );

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. audio_room_notes: admin SELECT for moderation investigation
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admins can view room notes" ON audio_room_notes;
CREATE POLICY "Admins can view room notes"
    ON audio_room_notes FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. audio_room_notes: co-host can delete notes in addition to host + author
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Authors and hosts can delete notes"
    ON audio_room_notes;
CREATE POLICY "Authors hosts and co-hosts can delete notes"
    ON audio_room_notes FOR DELETE
    TO authenticated
    USING (
        author_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM audio_rooms ar
            WHERE ar.id = room_id
              AND (ar.host_id = auth.uid() OR ar.co_host_id = auth.uid())
        )
    );

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. audio_room_notes: authors can update their own notes
-- ═══════════════════════════════════════════════════════════════════════════
-- Only update is allowed (no delete via this policy).  Hosts/co-hosts cannot
-- edit the content of another user's note -- they can only delete.

DROP POLICY IF EXISTS "Authors can update their notes"
    ON audio_room_notes;
CREATE POLICY "Authors can update their notes"
    ON audio_room_notes FOR UPDATE
    TO authenticated
    USING (author_id = auth.uid())
    WITH CHECK (author_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. audio_room_notes: admin DELETE for moderation
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admins can delete notes" ON audio_room_notes;
CREATE POLICY "Admins can delete notes"
    ON audio_room_notes FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. audio_room_tips: DELETE policy (sender + admin, for moderation/refunds)
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS audio_room_tips_delete_own ON public.audio_room_tips;
CREATE POLICY audio_room_tips_delete_own ON public.audio_room_tips
    FOR DELETE TO authenticated USING (
        auth.uid() = sender_user_id
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. call_logs: DELETE policy (own logs + admin for GDPR/right-to-erasure)
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS call_logs_delete_own ON public.call_logs;
CREATE POLICY call_logs_delete_own ON public.call_logs
    FOR DELETE TO authenticated USING (
        auth.uid() = caller_id
        OR auth.uid() = receiver_id
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. audio_room_captions: UPDATE policy for the caption author
-- ═══════════════════════════════════════════════════════════════════════════
-- Authors should be able to correct or expand their captions after posting.
-- Hosts/co-hosts can delete but not edit others' captions.

DROP POLICY IF EXISTS audio_room_captions_update_own ON public.audio_room_captions;
CREATE POLICY audio_room_captions_update_own ON public.audio_room_captions
    FOR UPDATE TO authenticated
    USING (auth.uid() = speaker_id)
    WITH CHECK (auth.uid() = speaker_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. audio_room_captions: admin UPDATE for moderation
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS audio_room_captions_update_admin ON public.audio_room_captions;
CREATE POLICY audio_room_captions_update_admin ON public.audio_room_captions
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. audio_room_notes: tighten INSERT to exclude archived/inactive rooms
-- ═══════════════════════════════════════════════════════════════════════════
-- Existing policy only checks NOT ar.is_archived.  We also reject inactive
-- rooms and ensure co-hosts/speakers (not just host) can post.

DROP POLICY IF EXISTS "Host and speakers can insert notes"
    ON audio_room_notes;
CREATE POLICY "Host speakers and co-hosts can insert notes"
    ON audio_room_notes FOR INSERT
    TO authenticated
    WITH CHECK (
        author_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM audio_rooms ar
            WHERE ar.id = room_id
              AND NOT ar.is_archived
              AND ar.is_active = true
              AND (
                  ar.host_id = auth.uid()
                  OR ar.co_host_id = auth.uid()
                  OR auth.uid() = ANY (ar.speakers)
              )
        )
    );
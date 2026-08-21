-- Remove legacy browser-side admin privileges from live audio room policies.
-- Existing participant, host, co-host, invited-user and author semantics remain.
-- Privileged moderation must use backend service-role operations protected by
-- admin capabilities and immutable audit logging.

DROP POLICY IF EXISTS audio_rooms_select_authenticated ON public.audio_rooms;
CREATE POLICY audio_rooms_select_authenticated ON public.audio_rooms
  FOR SELECT TO authenticated USING (
    is_private IS NULL
    OR is_private = false
    OR auth.uid() = host_id
    OR auth.uid() = co_host_id
    OR invited_user_ids IS NOT NULL AND auth.uid() = ANY (invited_user_ids)
  );

DROP POLICY IF EXISTS "Admins can view room notes" ON public.audio_room_notes;
DROP POLICY IF EXISTS "Admins can delete notes" ON public.audio_room_notes;

DROP POLICY IF EXISTS audio_room_tips_delete_own ON public.audio_room_tips;
CREATE POLICY audio_room_tips_delete_own ON public.audio_room_tips
  FOR DELETE TO authenticated USING (auth.uid() = sender_user_id);

DROP POLICY IF EXISTS call_logs_delete_own ON public.call_logs;
CREATE POLICY call_logs_delete_own ON public.call_logs
  FOR DELETE TO authenticated USING (
    auth.uid() = caller_id OR auth.uid() = receiver_id
  );

DROP POLICY IF EXISTS audio_room_captions_update_admin ON public.audio_room_captions;

-- Remove legacy browser-side admin privileges from video classroom tables.
-- Normal participant/host policies remain unchanged; privileged moderation must
-- use backend service-role operations protected by admin capabilities and audit.

DROP POLICY IF EXISTS audio_room_tips_select_admin ON public.audio_room_tips;
DROP POLICY IF EXISTS call_logs_select_admin ON public.call_logs;
DROP POLICY IF EXISTS quick_polls_select_admin ON public.quick_polls;
DROP POLICY IF EXISTS poll_votes_select_admin ON public.poll_votes;
DROP POLICY IF EXISTS audio_room_transcripts_select_admin ON public.audio_room_transcripts;
DROP POLICY IF EXISTS audio_rooms_delete_admin ON public.audio_rooms;
DROP POLICY IF EXISTS audio_room_captions_delete_admin ON public.audio_room_captions;

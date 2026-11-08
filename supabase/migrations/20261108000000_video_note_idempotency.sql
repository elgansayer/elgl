-- Instant video retries query one sender and one server-derived media URL:
--
--   SELECT * FROM public.chat_messages
--    WHERE sender_id = $1 AND media_url = $2
--    LIMIT 1;
--
-- The earlier chat media index covers image and video rows only. Add a v2
-- concurrency backstop across every chat-media presentation so simultaneous
-- standard-video and instant-video sends cannot reuse one object. The shipped
-- index remains in place. Older application versions ignore this additive
-- index, and IF NOT EXISTS keeps retries safe.
--
-- Rollback:
--   DROP INDEX IF EXISTS public.chat_messages_sender_media_url_v2_unique_idx;

CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_sender_media_url_v2_unique_idx
  ON public.chat_messages (sender_id, media_url)
  WHERE media_url IS NOT NULL
    AND message_type IN ('image', 'video', 'video_note');

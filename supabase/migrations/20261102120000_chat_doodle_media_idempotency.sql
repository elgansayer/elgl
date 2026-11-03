-- A single uploaded doodle object may back at most one persisted message.
--
-- Doodles now travel through the same owned-object pipeline as chat photos and
-- videos (presigned R2 upload, then POST /media/chat/send). That makes the
-- uploaded object a stable retry key: if the client loses the response after the
-- insert but before Centrifugo publication completes, the retry resolves the
-- existing row instead of creating a second doodle.
--
-- The predicate matches only URLs minted by that pipeline
-- (.../chat-media/<user>/doodle/standard/<object>.png). Legacy doodles stored the
-- whole PNG inline as a data URL in media_url: those rows are never indexed, so
-- the index stays small, and a multi-kilobyte value is never a btree key.
-- Existing rows cannot violate the constraint because no row predates the key
-- shape, so the build cannot fail on historical data.
--
-- Note: CREATE INDEX (non-concurrent) takes a short write lock on chat_messages
-- while it scans the table, matching 20260823030500_chat_media_idempotency.sql.
-- Rollback: DROP INDEX IF EXISTS public.chat_messages_sender_doodle_media_url_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_sender_doodle_media_url_unique_idx
  ON public.chat_messages (sender_id, media_url)
  WHERE message_type = 'doodle'
    AND media_url LIKE '%/chat-media/%/doodle/standard/%';

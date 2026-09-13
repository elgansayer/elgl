-- A single uploaded chat-media object may back at most one persisted message.
-- This makes retries safe when a client loses the response after the database
-- insert but before Centrifugo publication completes.
CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_sender_media_url_unique_idx
  ON public.chat_messages (sender_id, media_url)
  WHERE media_url IS NOT NULL
    AND message_type IN ('image', 'video');

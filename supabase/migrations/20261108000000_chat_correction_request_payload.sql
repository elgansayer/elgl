-- Persist correction requests as typed chat messages without rewriting deployed history.
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS correction_request_payload JSONB;

COMMENT ON COLUMN public.chat_messages.correction_request_payload IS
  'Source-text snapshot and optional target language for a correction_request message';

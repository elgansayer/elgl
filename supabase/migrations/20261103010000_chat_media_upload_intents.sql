-- Tracks short-lived direct uploads until a chat message references the object.
-- The retention worker deletes expired unreferenced objects and then this row.
-- Rollback is safe after disabling doodle presigning and the cleanup worker:
-- DROP TABLE IF EXISTS public.chat_media_upload_intents;
CREATE TABLE IF NOT EXISTS public.chat_media_upload_intents (
  object_key TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  media_kind TEXT NOT NULL CHECK (media_kind = 'doodle'),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_media_upload_intents_expiry_idx
  ON public.chat_media_upload_intents (expires_at);

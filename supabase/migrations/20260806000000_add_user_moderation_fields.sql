-- Add moderation fields for 1-click ban and warning
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS warning_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS users_is_banned_idx ON public.users (is_banned);
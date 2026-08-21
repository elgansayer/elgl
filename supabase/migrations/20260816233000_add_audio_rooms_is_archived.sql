-- Make the archive-state contract used by audio room note policies explicit.
-- This migration is idempotent because some deployed environments may already
-- have the column through historical/manual schema evolution.
ALTER TABLE public.audio_rooms
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS audio_rooms_archive_state_idx
  ON public.audio_rooms (is_archived, created_at DESC);

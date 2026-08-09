-- Migration: Add event_id to audio_rooms for language party integration
-- This allows scheduled events to automatically spin up audio rooms
-- and maintain a back-reference to their originating event.

ALTER TABLE public.audio_rooms
  ADD COLUMN IF NOT EXISTS event_id UUID;

CREATE INDEX IF NOT EXISTS idx_audio_rooms_event_id
  ON public.audio_rooms (event_id);
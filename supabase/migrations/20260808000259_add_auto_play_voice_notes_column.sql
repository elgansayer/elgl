-- Migration: Add auto_play_voice_notes column to users table
-- Required for #1039: settings toggle to auto-play sequential voice notes in chat

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auto_play_voice_notes boolean DEFAULT false;

COMMENT ON COLUMN public.users.auto_play_voice_notes IS 'Auto-play sequential voice notes one after another in chat rooms';
-- Migration: add audio_room_transcripts table and egress_id column to audio_rooms

CREATE TABLE IF NOT EXISTS audio_room_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES audio_rooms(id) ON DELETE CASCADE,
  recording_url TEXT NOT NULL,
  transcript_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add egress_id column if it doesn't exist yet (older DB may already have it)
ALTER TABLE audio_rooms ADD COLUMN IF NOT EXISTS egress_id TEXT;

-- Index for faster look‑ups by room
CREATE INDEX IF NOT EXISTS idx_audio_room_transcripts_room_id ON audio_room_transcripts(room_id);

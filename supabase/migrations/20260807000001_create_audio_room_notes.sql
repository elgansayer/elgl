-- Create audio_room_notes table for shared Voiceroom Notes panel
-- where hosts/speakers can post key vocabulary or discussion topics.
CREATE TABLE IF NOT EXISTS audio_room_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES audio_rooms(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  vocabulary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audio_room_notes_room_id ON audio_room_notes(room_id);
CREATE INDEX idx_audio_room_notes_created_at ON audio_room_notes(created_at DESC);

-- Enable RLS
ALTER TABLE audio_room_notes ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view notes for rooms they can access
CREATE POLICY "Authenticated users can view room notes"
  ON audio_room_notes FOR SELECT
  TO authenticated
  USING (true);

-- Only host or speakers can insert notes
CREATE POLICY "Host and speakers can insert notes"
  ON audio_room_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM audio_rooms ar
      WHERE ar.id = room_id
      AND NOT ar.is_archived
    )
  );

-- Authors can delete their own notes; hosts can delete any note in their room
CREATE POLICY "Authors and hosts can delete notes"
  ON audio_room_notes FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM audio_rooms ar
      WHERE ar.id = room_id
      AND ar.host_id = auth.uid()
    )
  );
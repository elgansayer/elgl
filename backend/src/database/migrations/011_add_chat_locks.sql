-- Add is_locked column to chat_room_members for Chat Lock feature
ALTER TABLE IF EXISTS chat_room_members
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

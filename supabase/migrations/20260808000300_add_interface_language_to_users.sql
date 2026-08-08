-- Add interface_language column to users table so the UI language preference
-- can be persisted independently of study target languages and synced across devices.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS interface_language text;
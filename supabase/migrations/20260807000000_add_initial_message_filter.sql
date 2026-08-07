-- Add initial_message_filter JSONB column to users table
-- This stores user preferences for filtering who can send initial messages
-- based on age range and native language(s)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS initial_message_filter JSONB DEFAULT NULL;

COMMENT ON COLUMN public.users.initial_message_filter IS
  'JSON object: { enabled: boolean, min_age?: number, max_age?: number, native_languages?: string[] }';
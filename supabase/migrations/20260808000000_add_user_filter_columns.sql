-- Add age, gender, and message_filters columns to users table
-- for the User Filter Settings feature (#549)

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS message_filters JSONB;
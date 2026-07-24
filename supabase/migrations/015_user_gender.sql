-- Add gender and privacy_hide_gender to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
ADD COLUMN IF NOT EXISTS privacy_hide_gender BOOLEAN NOT NULL DEFAULT false;

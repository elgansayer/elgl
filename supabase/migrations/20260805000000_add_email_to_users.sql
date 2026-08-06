-- Add email column to users table for password reset lookups
-- Emails are synced from auth.users when the profile is created

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS idx_users_email
    ON public.users (email);
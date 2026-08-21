-- Add is_deleted and deleted_at columns to users table for GDPR deletion finalisation
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS users_is_deleted_idx ON public.users (is_deleted)
  WHERE is_deleted = true;
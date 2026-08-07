-- Add account deletion workflow columns to users table
-- scheduled_for_deletion_at: timestamp when the 30-day grace period expires
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS scheduled_for_deletion_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_deletion_pending BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS users_scheduled_for_deletion_idx ON public.users (scheduled_for_deletion_at)
  WHERE scheduled_for_deletion_at IS NOT NULL;
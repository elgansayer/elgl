-- Create archive_requests table for GDPR data archive tracking
CREATE TABLE IF NOT EXISTS public.archive_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archive_url TEXT,
  receipt_id TEXT,
  app_store TEXT,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS archive_requests_user_id_idx ON public.archive_requests (user_id);
CREATE INDEX IF NOT EXISTS archive_requests_requested_at_idx ON public.archive_requests (requested_at);
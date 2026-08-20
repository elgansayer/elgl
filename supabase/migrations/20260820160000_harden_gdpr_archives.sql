-- Harden GDPR archive storage and metadata access.
--
-- The backend uses the Supabase service role, which bypasses RLS. The old
-- "Service role can manage archive requests" policy was not scoped to the
-- service_role role and therefore granted every authenticated role broad
-- write access. Remove it and retain only the existing per-user SELECT policy.

ALTER TABLE public.archive_requests
  ADD COLUMN IF NOT EXISTS archive_path TEXT;

DROP POLICY IF EXISTS "Service role can manage archive requests"
  ON public.archive_requests;

CREATE INDEX IF NOT EXISTS archive_requests_user_requested_at_idx
  ON public.archive_requests (user_id, requested_at DESC);

-- GDPR exports must never be exposed as public storage objects. The API
-- creates short-lived signed URLs after authenticating the requesting user.
INSERT INTO storage.buckets (id, name, public)
VALUES ('gdpr-archives', 'gdpr-archives', false)
ON CONFLICT (id) DO UPDATE
SET public = false;

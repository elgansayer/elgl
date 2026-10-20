-- Harden GDPR archive storage and request tracking.
-- Existing public archive URLs are deliberately invalidated: personal-data exports
-- must only be retrievable through short-lived server-generated signed URLs.

ALTER TABLE public.archive_requests
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'processing',
  ADD COLUMN IF NOT EXISTS object_key TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_code TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.archive_requests
  DROP CONSTRAINT IF EXISTS archive_requests_status_check;
ALTER TABLE public.archive_requests
  ADD CONSTRAINT archive_requests_status_check
  CHECK (status IN ('processing', 'ready', 'failed', 'expired'));

-- Historical rows used public URLs. Do not continue advertising those URLs after
-- this migration: users can request a fresh private export instead.
UPDATE public.archive_requests
SET archive_url = NULL,
    status = 'expired',
    failure_code = 'legacy_public_archive_invalidated',
    updated_at = NOW()
WHERE archive_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS archive_requests_user_created_idx
  ON public.archive_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS archive_requests_expiry_idx
  ON public.archive_requests (status, expires_at)
  WHERE status = 'ready';
CREATE UNIQUE INDEX IF NOT EXISTS archive_requests_one_processing_per_user_idx
  ON public.archive_requests (user_id)
  WHERE status = 'processing';

ALTER TABLE public.archive_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage archive requests" ON public.archive_requests;
DROP POLICY IF EXISTS "Users can view own archive requests" ON public.archive_requests;

CREATE POLICY "Users can view own archive requests"
  ON public.archive_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- The service role bypasses RLS, but the explicit grants below also make the
-- intended trust boundary clear and prevent browser roles from mutating rows.
REVOKE INSERT, UPDATE, DELETE ON public.archive_requests FROM anon, authenticated;
GRANT SELECT ON public.archive_requests TO authenticated;

-- Supabase Storage bucket must remain private. The backend service-role client
-- performs uploads/deletes and issues five-minute signed URLs after ownership
-- verification.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gdpr-archives',
  'gdpr-archives',
  false,
  52428800,
  ARRAY['application/json']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Remove any legacy object policies that mention this bucket. Storage policies
-- are permissive (ORed), so retaining an old authenticated read policy could
-- undermine a private bucket by allowing authenticated direct reads.
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        COALESCE(qual, '') ILIKE '%gdpr-archives%'
        OR COALESCE(with_check, '') ILIKE '%gdpr-archives%'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON storage.objects',
      policy_record.policyname
    );
  END LOOP;
END
$$;

-- The existing automated deletion worker removes public.users after the 30-day
-- grace period. public.users references auth.users in the opposite direction,
-- so deleting only the profile would otherwise leave a login-capable auth row.
-- This AFTER DELETE trigger makes permanent deletion include the Supabase Auth
-- principal in the same database transaction. Deleting auth.users cascades back
-- to public.users, where the row is already gone, so there is no recursion loop.
CREATE OR REPLACE FUNCTION public.delete_auth_principal_after_profile_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_auth_principal_after_profile_delete() FROM PUBLIC;

DROP TRIGGER IF EXISTS delete_auth_principal_after_profile_delete ON public.users;
CREATE TRIGGER delete_auth_principal_after_profile_delete
AFTER DELETE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.delete_auth_principal_after_profile_delete();

-- Migration: Harden Developer Tier API key persistence (#1003)
--
-- The legacy Developer Tier flow writes a freshly generated `ht_dev_*` key to
-- public.users.developer_api_key and returns that value to the caller. Keeping
-- that secret in plaintext after issuance means a later database read or
-- analytics response can recover the credential. This migration preserves the
-- mixed-version API contract while making persistence one-way:
--
--   * the raw key is returned by the existing POST /monetisation/generate-api-key
--     request, but the database stores only a SHA-256 digest plus a redacted
--     display value;
--   * existing plaintext keys are backfilled in place;
--   * future writes from old and new backend versions are protected by a trigger;
--   * browser roles cannot mutate the credential material directly.
--
-- No API response shape changes are required. GET /monetisation/analytics keeps
-- returning `api_key`, but after the one-time issuance response it is a redacted
-- identifier such as `ht_dev_012345678…cdef`, never the reusable secret.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS developer_api_key_hash TEXT NULL,
  ADD COLUMN IF NOT EXISTS developer_api_key_prefix VARCHAR(24) NULL,
  ADD COLUMN IF NOT EXISTS developer_api_key_last_four VARCHAR(4) NULL,
  ADD COLUMN IF NOT EXISTS developer_api_key_created_at TIMESTAMPTZ NULL;

-- Backfill legacy plaintext credentials before installing the write trigger.
-- The predicate intentionally ignores null, empty, already-redacted and
-- otherwise malformed values so a retry is safe.
UPDATE public.users
SET
  developer_api_key_hash = encode(digest(developer_api_key, 'sha256'), 'hex'),
  developer_api_key_prefix = left(developer_api_key, 15),
  developer_api_key_last_four = right(developer_api_key, 4),
  developer_api_key_created_at = COALESCE(developer_api_key_created_at, now()),
  developer_api_key = left(developer_api_key, 15) || '…' || right(developer_api_key, 4)
WHERE developer_api_key ~ '^ht_dev_[0-9a-fA-F]{32}$';

CREATE UNIQUE INDEX IF NOT EXISTS users_developer_api_key_hash_uidx
  ON public.users (developer_api_key_hash)
  WHERE developer_api_key_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.protect_developer_api_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  raw_key TEXT;
  request_role TEXT := COALESCE(auth.role(), '');
  credential_changed BOOLEAN;
BEGIN
  credential_changed :=
    (TG_OP = 'INSERT' AND (
      NEW.developer_api_key IS NOT NULL OR
      NEW.developer_api_key_hash IS NOT NULL OR
      NEW.developer_api_key_prefix IS NOT NULL OR
      NEW.developer_api_key_last_four IS NOT NULL OR
      NEW.developer_api_key_created_at IS NOT NULL
    )) OR
    (TG_OP = 'UPDATE' AND (
      NEW.developer_api_key IS DISTINCT FROM OLD.developer_api_key OR
      NEW.developer_api_key_hash IS DISTINCT FROM OLD.developer_api_key_hash OR
      NEW.developer_api_key_prefix IS DISTINCT FROM OLD.developer_api_key_prefix OR
      NEW.developer_api_key_last_four IS DISTINCT FROM OLD.developer_api_key_last_four OR
      NEW.developer_api_key_created_at IS DISTINCT FROM OLD.developer_api_key_created_at
    ));

  -- API-key lifecycle is owned by the trusted backend. A browser using the
  -- authenticated/anon Supabase role must not be able to mint, replace, redact
  -- or revoke developer credentials by writing the users table directly.
  IF credential_changed AND request_role IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Developer API credentials are server-managed'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.developer_api_key IS NOT DISTINCT FROM OLD.developer_api_key THEN
    -- Do not allow callers to tamper with derived metadata independently of the
    -- key. Trusted maintenance can still clear all fields by changing the
    -- developer_api_key column itself to NULL.
    IF
      NEW.developer_api_key_hash IS DISTINCT FROM OLD.developer_api_key_hash OR
      NEW.developer_api_key_prefix IS DISTINCT FROM OLD.developer_api_key_prefix OR
      NEW.developer_api_key_last_four IS DISTINCT FROM OLD.developer_api_key_last_four OR
      NEW.developer_api_key_created_at IS DISTINCT FROM OLD.developer_api_key_created_at
    THEN
      RAISE EXCEPTION 'Developer API key metadata is derived and cannot be changed directly'
        USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.developer_api_key IS NULL OR btrim(NEW.developer_api_key) = '' THEN
    NEW.developer_api_key := NULL;
    NEW.developer_api_key_hash := NULL;
    NEW.developer_api_key_prefix := NULL;
    NEW.developer_api_key_last_four := NULL;
    NEW.developer_api_key_created_at := NULL;
    RETURN NEW;
  END IF;

  -- Mixed-version compatibility: old backend releases keep assigning the raw
  -- value to users.developer_api_key. The trigger immediately derives the
  -- verification digest and replaces plaintext with a display-safe identifier.
  IF NEW.developer_api_key !~ '^ht_dev_[0-9a-fA-F]{32}$' THEN
    RAISE EXCEPTION 'Invalid developer API key format'
      USING ERRCODE = '22023';
  END IF;

  raw_key := NEW.developer_api_key;
  NEW.developer_api_key_hash := encode(digest(raw_key, 'sha256'), 'hex');
  NEW.developer_api_key_prefix := left(raw_key, 15);
  NEW.developer_api_key_last_four := right(raw_key, 4);
  NEW.developer_api_key_created_at := clock_timestamp();
  NEW.developer_api_key := NEW.developer_api_key_prefix || '…' || NEW.developer_api_key_last_four;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_developer_api_key_trigger ON public.users;
CREATE TRIGGER protect_developer_api_key_trigger
BEFORE INSERT OR UPDATE OF
  developer_api_key,
  developer_api_key_hash,
  developer_api_key_prefix,
  developer_api_key_last_four,
  developer_api_key_created_at
ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.protect_developer_api_key();

COMMENT ON COLUMN public.users.developer_api_key IS
  'Redacted Developer Tier API key identifier. The reusable plaintext secret is returned only when issued and is never persisted.';
COMMENT ON COLUMN public.users.developer_api_key_hash IS
  'SHA-256 digest used for constant-size developer API credential lookup/verification; never return to browser clients.';
COMMENT ON COLUMN public.users.developer_api_key_prefix IS
  'Non-secret prefix retained for key identification in developer tooling.';
COMMENT ON COLUMN public.users.developer_api_key_last_four IS
  'Final four hexadecimal characters retained for key identification in developer tooling.';
COMMENT ON COLUMN public.users.developer_api_key_created_at IS
  'Timestamp of the most recent Developer Tier API key rotation.';

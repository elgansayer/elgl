-- COPPA age assurance (issue #2044).
--
-- Every account must declare a date of birth through the authenticated API
-- before it can use the product. Declarations under the minimum age block the
-- account and feed the existing account-deletion pipeline; the date of birth of
-- a blocked account is never stored.
--
-- Rollout and compatibility
--   * Additive only. Older application versions ignore the new columns, and
--     accounts they create receive the 'required' default.
--   * Accounts that already exist are marked 'legacy' by the column default
--     (a metadata-only change on PostgreSQL 11+). The API treats 'legacy' as
--     allowed until AGE_GATE_LEGACY_ENFORCEMENT_FROM, so the rollout date is an
--     operator decision rather than a deploy side effect.
--   * Accounts whose self-declared users.age is 1-12 are blocked and hidden
--     here. This is the only data change; the API sweep schedules their erasure.
--
-- Rollback: DROP TRIGGER users_protect_age_gate_columns ON public.users;
--           DROP FUNCTION public.protect_age_gate_columns();
--           DROP TABLE public.age_gate_lockouts, public.age_gate_events;
--           ALTER TABLE public.users DROP COLUMN age_gate_completed_at,
--               DROP COLUMN age_gate_status, DROP COLUMN date_of_birth;
--           Blocked accounts stay hidden until their status is reviewed by hand.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS age_gate_status TEXT NOT NULL DEFAULT 'legacy',
    ADD COLUMN IF NOT EXISTS age_gate_completed_at TIMESTAMPTZ;

-- Existing rows keep 'legacy' (the default recorded when the column was added);
-- rows created from now on must pass the gate.
ALTER TABLE public.users
    ALTER COLUMN age_gate_status SET DEFAULT 'required';

ALTER TABLE public.users
    DROP CONSTRAINT IF EXISTS users_age_gate_status_check;
ALTER TABLE public.users
    ADD CONSTRAINT users_age_gate_status_check
    CHECK (age_gate_status IN ('legacy', 'required', 'passed', 'blocked_under_age'))
    NOT VALID;
ALTER TABLE public.users VALIDATE CONSTRAINT users_age_gate_status_check;

-- Data minimisation: a blocked account never keeps a date of birth, and a
-- passed account always has one with the time it was recorded.
ALTER TABLE public.users
    DROP CONSTRAINT IF EXISTS users_age_gate_consistency_check;
ALTER TABLE public.users
    ADD CONSTRAINT users_age_gate_consistency_check
    CHECK (
        (age_gate_status <> 'blocked_under_age' OR date_of_birth IS NULL)
        AND (
            age_gate_status <> 'passed'
            OR (date_of_birth IS NOT NULL AND age_gate_completed_at IS NOT NULL)
        )
        AND (date_of_birth IS NULL OR date_of_birth >= DATE '1900-01-01')
    )
    NOT VALID;
ALTER TABLE public.users VALIDATE CONSTRAINT users_age_gate_consistency_check;

-- Actual knowledge: an account that declared an age under 13 on its profile is
-- blocked and hidden immediately. The statement is idempotent and does not
-- touch accounts that are already gated.
UPDATE public.users
SET age_gate_status = 'blocked_under_age',
    age_gate_completed_at = COALESCE(age_gate_completed_at, now()),
    age = NULL,
    privacy_hide_from_search = true
WHERE age BETWEEN 1 AND 12
  AND age_gate_status IN ('legacy', 'required');

-- Sweep queries look for blocked accounts that still need erasure.
CREATE INDEX IF NOT EXISTS users_age_gate_blocked_idx
    ON public.users (age_gate_completed_at)
    WHERE age_gate_status = 'blocked_under_age';

-- Browser roles reach public.users through PostgREST under users_update_own, so
-- the gate columns are guarded by a trigger rather than trusting the client.
-- The backend (service_role) and migrations are trusted.
CREATE OR REPLACE FUNCTION public.protect_age_gate_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF current_user NOT IN ('anon', 'authenticated') THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.age_gate_status := 'required';
        NEW.age_gate_completed_at := NULL;
        NEW.date_of_birth := NULL;
        RETURN NEW;
    END IF;

    IF NEW.age_gate_status IS DISTINCT FROM OLD.age_gate_status
       OR NEW.age_gate_completed_at IS DISTINCT FROM OLD.age_gate_completed_at
       OR NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth
       OR (OLD.date_of_birth IS NOT NULL AND NEW.age IS DISTINCT FROM OLD.age)
    THEN
        RAISE EXCEPTION 'age assurance fields can only be changed by the server'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_age_gate_columns()
    FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS users_protect_age_gate_columns ON public.users;
CREATE TRIGGER users_protect_age_gate_columns
    BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_age_gate_columns();

-- Outcome log. subject_id is deliberately not a foreign key: rows must survive
-- account erasure and carry no date of birth, email or other personal data.
-- Retention: 24 months, purged daily by the age-gate maintenance job.
CREATE TABLE IF NOT EXISTS public.age_gate_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID,
    outcome TEXT NOT NULL CHECK (
        outcome IN (
            'passed',
            'blocked_under_age',
            'lockout_blocked',
            'erasure_scheduled',
            'identity_purged'
        )
    ),
    minimum_age SMALLINT NOT NULL CHECK (minimum_age BETWEEN 13 AND 18),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS age_gate_events_created_idx
    ON public.age_gate_events (created_at);
CREATE INDEX IF NOT EXISTS age_gate_events_subject_idx
    ON public.age_gate_events (subject_id, created_at DESC)
    WHERE subject_id IS NOT NULL;

-- Short cool-off after an under-age declaration so the same mailbox cannot
-- simply retry with a different date. Only a keyed hash of the email address is
-- stored. Retention: rows expire at locked_until and are purged daily.
CREATE TABLE IF NOT EXISTS public.age_gate_lockouts (
    identifier_hash TEXT PRIMARY KEY CHECK (identifier_hash ~ '^[0-9a-f]{64}$'),
    locked_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS age_gate_lockouts_locked_until_idx
    ON public.age_gate_lockouts (locked_until);

ALTER TABLE public.age_gate_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.age_gate_lockouts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.age_gate_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.age_gate_lockouts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.age_gate_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.age_gate_lockouts TO service_role;

COMMENT ON COLUMN public.users.date_of_birth IS
    'Private date of birth declared through the age gate. Never exposed by public profile endpoints and never stored for blocked accounts.';
COMMENT ON COLUMN public.users.age_gate_status IS
    'legacy: created before the age gate; required: must declare a date of birth; passed: declared at or above the minimum age; blocked_under_age: declared below the minimum age.';
COMMENT ON TABLE public.age_gate_events IS
    'Pseudonymous outcome log for age-gate decisions. Contains no date of birth, email or name.';
COMMENT ON TABLE public.age_gate_lockouts IS
    'Keyed email hashes locked out after an under-age declaration. Expires at locked_until.';

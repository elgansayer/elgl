-- Harden the "Who Viewed Me" audit trail.
--
-- Goals:
--   * one persisted/notification-producing visit per viewer/profile/UTC day;
--   * service-role-only reads so authenticated clients cannot bypass the VIP mask;
--   * 90-day retention;
--   * erase historical visit relationships when users block one another or a
--     profile becomes hidden/deleted/deletion-pending.

ALTER TABLE public.profile_visits
  ADD COLUMN IF NOT EXISTS visit_day date;

UPDATE public.profile_visits
SET visit_day = (created_at AT TIME ZONE 'UTC')::date
WHERE visit_day IS NULL;

-- Existing data may contain many refresh-generated rows for the same pair/day.
-- Keep the newest row before installing the concurrency-safe unique index.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY visitor_id, viewed_id, visit_day
      ORDER BY created_at DESC, id DESC
    ) AS row_number
  FROM public.profile_visits
)
DELETE FROM public.profile_visits AS visits
USING ranked
WHERE visits.id = ranked.id
  AND ranked.row_number > 1;

ALTER TABLE public.profile_visits
  ALTER COLUMN visit_day SET DEFAULT ((now() AT TIME ZONE 'UTC')::date),
  ALTER COLUMN visit_day SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profile_visits_unique_daily_idx
  ON public.profile_visits (visitor_id, viewed_id, visit_day);

CREATE INDEX IF NOT EXISTS profile_visits_created_at_idx
  ON public.profile_visits (created_at);

-- The NestJS API is the privacy/entitlement boundary and uses service_role.
-- Raw authenticated reads would expose visitor_id even when the owner is not
-- entitled to identity visibility, so remove direct-client policies entirely.
DROP POLICY IF EXISTS profile_visits_select_own ON public.profile_visits;
DROP POLICY IF EXISTS profile_visits_insert_own ON public.profile_visits;

-- Establish the retention baseline immediately. The insert trigger below keeps
-- it bounded without relying on an optional pg_cron extension.
DELETE FROM public.profile_visits
WHERE created_at < now() - interval '90 days';

CREATE OR REPLACE FUNCTION public.enforce_profile_visit_retention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.profile_visits
  WHERE created_at < now() - interval '90 days';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS profile_visits_retention_after_insert
  ON public.profile_visits;
CREATE TRIGGER profile_visits_retention_after_insert
AFTER INSERT ON public.profile_visits
FOR EACH STATEMENT
EXECUTE FUNCTION public.enforce_profile_visit_retention();

CREATE OR REPLACE FUNCTION public.purge_profile_visits_on_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.profile_visits
  WHERE (visitor_id = NEW.blocker_id AND viewed_id = NEW.blocked_id)
     OR (visitor_id = NEW.blocked_id AND viewed_id = NEW.blocker_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS purge_profile_visits_after_block
  ON public.blocks;
CREATE TRIGGER purge_profile_visits_after_block
AFTER INSERT ON public.blocks
FOR EACH ROW
EXECUTE FUNCTION public.purge_profile_visits_on_block();

CREATE OR REPLACE FUNCTION public.purge_profile_visits_on_privacy_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.is_deleted, false)
     OR NEW.scheduled_for_deletion_at IS NOT NULL
     OR NEW.profile_visibility = 'hidden' THEN
    DELETE FROM public.profile_visits
    WHERE visitor_id = NEW.id OR viewed_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS purge_profile_visits_after_privacy_change
  ON public.users;
CREATE TRIGGER purge_profile_visits_after_privacy_change
AFTER UPDATE OF is_deleted, scheduled_for_deletion_at, profile_visibility
ON public.users
FOR EACH ROW
WHEN (
  OLD.is_deleted IS DISTINCT FROM NEW.is_deleted
  OR OLD.scheduled_for_deletion_at IS DISTINCT FROM NEW.scheduled_for_deletion_at
  OR OLD.profile_visibility IS DISTINCT FROM NEW.profile_visibility
)
EXECUTE FUNCTION public.purge_profile_visits_on_privacy_change();

COMMENT ON COLUMN public.profile_visits.visit_day IS
  'UTC calendar day used to coalesce repeated profile views into one visit/notification per viewer/profile/day.';

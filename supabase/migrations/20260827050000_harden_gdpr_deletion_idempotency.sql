-- Keep account-deletion scheduling idempotent across retries and mixed-version clients.
-- A repeated request while deletion is already pending must never extend the
-- original 30-day grace-period deadline.

UPDATE public.users
SET
  deletion_requested_at = COALESCE(deletion_requested_at, now()),
  scheduled_for_deletion_at = COALESCE(
    scheduled_for_deletion_at,
    COALESCE(deletion_requested_at, now()) + interval '30 days'
  )
WHERE is_deletion_pending = true
  AND (deletion_requested_at IS NULL OR scheduled_for_deletion_at IS NULL);

CREATE OR REPLACE FUNCTION public.preserve_pending_account_deletion_deadline()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.is_deletion_pending = true AND NEW.is_deletion_pending = true THEN
    NEW.deletion_requested_at := COALESCE(
      OLD.deletion_requested_at,
      NEW.deletion_requested_at
    );
    NEW.scheduled_for_deletion_at := COALESCE(
      OLD.scheduled_for_deletion_at,
      NEW.scheduled_for_deletion_at
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS preserve_pending_account_deletion_deadline ON public.users;

CREATE TRIGGER preserve_pending_account_deletion_deadline
BEFORE UPDATE OF
  is_deletion_pending,
  scheduled_for_deletion_at,
  deletion_requested_at
ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.preserve_pending_account_deletion_deadline();

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_pending_deletion_requires_schedule;

ALTER TABLE public.users
  ADD CONSTRAINT users_pending_deletion_requires_schedule
  CHECK (
    is_deletion_pending = false
    OR scheduled_for_deletion_at IS NOT NULL
  );

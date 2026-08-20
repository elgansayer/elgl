-- Persist the user's intended quiet-hours timezone so notification suppression
-- is independent of the backend host timezone and remains DST-aware.
-- Nullable preserves mixed-version deploys: older application versions neither
-- read nor write this column, while newer code falls back to UTC for legacy rows.

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS quiet_hours_timezone text;

COMMENT ON COLUMN public.notification_preferences.quiet_hours_timezone IS
  'IANA timezone used to evaluate scheduled quiet hours (for example Europe/London).';

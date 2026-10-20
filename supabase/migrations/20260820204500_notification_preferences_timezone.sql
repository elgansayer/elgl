-- Converge notification_preferences into the root Supabase migration history and
-- persist the user's intended quiet-hours timezone. The feature originally had a
-- module-local migration under backend/src/notifications/migrations, which is not
-- part of a clean `supabase db reset`. Keeping this migration idempotent lets it
-- repair clean/local environments without disrupting deployments where the table
-- already exists.

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  new_message JSONB NOT NULL DEFAULT '{"push": true, "email": false, "in_app": true, "badges": true}',
  call_invite JSONB NOT NULL DEFAULT '{"push": true, "email": false, "in_app": true, "badges": true}',
  moment_like JSONB NOT NULL DEFAULT '{"push": true, "email": false, "in_app": true, "badges": true}',
  moment_comment JSONB NOT NULL DEFAULT '{"push": true, "email": false, "in_app": true, "badges": true}',
  correction JSONB NOT NULL DEFAULT '{"push": true, "email": false, "in_app": true, "badges": true}',
  gift JSONB NOT NULL DEFAULT '{"push": true, "email": false, "in_app": true, "badges": true}',
  profile_view JSONB NOT NULL DEFAULT '{"push": false, "email": false, "in_app": true, "badges": true}',
  study_reminder JSONB NOT NULL DEFAULT '{"push": true, "email": true, "in_app": true, "badges": true}',
  friend_request JSONB NOT NULL DEFAULT '{"push": true, "email": false, "in_app": true, "badges": true}',
  audio_room_invite JSONB NOT NULL DEFAULT '{"push": true, "email": false, "in_app": true, "badges": true}',
  new_follower JSONB NOT NULL DEFAULT '{"push": true, "email": false, "in_app": true, "badges": true}',
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  quiet_hours_timezone TEXT,
  do_not_disturb BOOLEAN NOT NULL DEFAULT false,
  custom_tone_url TEXT,
  vibration_pattern TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_preferences_quiet_hours_pair CHECK (
    (quiet_hours_start IS NULL AND quiet_hours_end IS NULL)
    OR (quiet_hours_start IS NOT NULL AND quiet_hours_end IS NOT NULL)
  )
);

-- Existing deployments can pre-date newer preference fields. Add them
-- independently so this migration converges both fresh and long-lived schemas.
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS new_follower JSONB NOT NULL
    DEFAULT '{"push": true, "email": false, "in_app": true, "badges": true}',
  ADD COLUMN IF NOT EXISTS quiet_hours_timezone TEXT,
  ADD COLUMN IF NOT EXISTS custom_tone_url TEXT,
  ADD COLUMN IF NOT EXISTS vibration_pattern TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_preferences_user_id_unique
  ON public.notification_preferences(user_id);

CREATE OR REPLACE FUNCTION public.update_notification_preferences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trigger_notification_preferences_updated_at'
      AND tgrelid = 'public.notification_preferences'::regclass
  ) THEN
    CREATE TRIGGER trigger_notification_preferences_updated_at
      BEFORE UPDATE ON public.notification_preferences
      FOR EACH ROW
      EXECUTE FUNCTION public.update_notification_preferences_updated_at();
  END IF;
END
$$;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_preferences'
      AND policyname = 'Users can view their own notification preferences'
  ) THEN
    CREATE POLICY "Users can view their own notification preferences"
      ON public.notification_preferences FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_preferences'
      AND policyname = 'Users can insert their own notification preferences'
  ) THEN
    CREATE POLICY "Users can insert their own notification preferences"
      ON public.notification_preferences FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_preferences'
      AND policyname = 'Users can update their own notification preferences'
  ) THEN
    CREATE POLICY "Users can update their own notification preferences"
      ON public.notification_preferences FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

COMMENT ON COLUMN public.notification_preferences.quiet_hours_timezone IS
  'IANA timezone used to evaluate scheduled quiet hours (for example Europe/London).';

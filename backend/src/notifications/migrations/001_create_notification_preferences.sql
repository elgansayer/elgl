-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  do_not_disturb BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_user_preferences UNIQUE (user_id),
  CONSTRAINT valid_quiet_hours CHECK (
    (quiet_hours_start IS NULL AND quiet_hours_end IS NULL) OR
    (quiet_hours_start IS NOT NULL AND quiet_hours_end IS NOT NULL)
  )
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_updated_at();

-- Enable Row Level Security
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own notification preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

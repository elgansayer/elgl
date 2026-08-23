-- Disappearing chat messages (#1196)
--
-- A sender chooses a default retention policy in users.chat_preferences.
-- The policy is snapshotted onto each new message as expires_at so changing a
-- preference never retroactively shortens or extends already-sent content.

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS chat_messages_expires_at_idx
  ON public.chat_messages (expires_at)
  WHERE expires_at IS NOT NULL;

COMMENT ON COLUMN public.chat_messages.expires_at IS
  'Absolute expiry assigned at insert time from the sender chat preference; NULL means retain normally.';

CREATE OR REPLACE FUNCTION public.apply_chat_message_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  retention_setting TEXT;
  base_time TIMESTAMPTZ;
BEGIN
  SELECT chat_preferences ->> 'disappearingMessagesTtl'
    INTO retention_setting
    FROM public.users
   WHERE id = NEW.sender_id;

  base_time := COALESCE(NEW.created_at, now());

  NEW.expires_at := CASE retention_setting
    WHEN '24h' THEN base_time + INTERVAL '24 hours'
    WHEN '7d' THEN base_time + INTERVAL '7 days'
    WHEN '90d' THEN base_time + INTERVAL '90 days'
    ELSE NULL
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_messages_apply_expiry ON public.chat_messages;
CREATE TRIGGER chat_messages_apply_expiry
BEFORE INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.apply_chat_message_expiry();

-- Authenticated/browser clients must not be able to invoke the trigger helper
-- directly. It is executed only by PostgreSQL as part of message insertion.
REVOKE ALL ON FUNCTION public.apply_chat_message_expiry() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_chat_message_expiry() FROM anon;
REVOKE ALL ON FUNCTION public.apply_chat_message_expiry() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_chat_message_expiry() TO service_role;

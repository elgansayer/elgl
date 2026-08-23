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

  -- Always derive expiry from the sender's persisted preference. Caller-provided
  -- expires_at values are deliberately ignored.
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

CREATE OR REPLACE FUNCTION public.purge_expired_chat_messages(p_limit INTEGER DEFAULT 500)
RETURNS TABLE(message_id UUID, room_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 500), 1), 1000);
BEGIN
  RETURN QUERY
  WITH victims AS (
    SELECT m.id, m.room_id
      FROM public.chat_messages AS m
     WHERE m.expires_at IS NOT NULL
       AND m.expires_at <= now()
     ORDER BY m.expires_at ASC, m.id ASC
     LIMIT safe_limit
     FOR UPDATE SKIP LOCKED
  ), deleted_snapshots AS (
    DELETE FROM public.favourites AS f
     USING victims AS v
     WHERE f.item_type = 'message'
       AND f.item_payload ->> 'id' = v.id::TEXT
     RETURNING f.id
  ), deleted_messages AS (
    DELETE FROM public.chat_messages AS m
     USING victims AS v
     WHERE m.id = v.id
     RETURNING m.id, m.room_id
  )
  SELECT d.id, d.room_id FROM deleted_messages AS d;
END;
$$;

-- Authenticated/browser clients must not be able to invoke retention helpers
-- directly. The trigger runs inside PostgreSQL and cleanup is backend-only.
REVOKE ALL ON FUNCTION public.apply_chat_message_expiry() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_chat_message_expiry() FROM anon;
REVOKE ALL ON FUNCTION public.apply_chat_message_expiry() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_chat_message_expiry() TO service_role;

REVOKE ALL ON FUNCTION public.purge_expired_chat_messages(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_expired_chat_messages(INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.purge_expired_chat_messages(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_chat_messages(INTEGER) TO service_role;

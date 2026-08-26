-- End-to-end encryption metadata for personal (two-member) chat rooms.
-- Private keys never leave clients. The backend stores only public device keys,
-- encrypted key envelopes and message ciphertext.

CREATE TABLE IF NOT EXISTS public.chat_e2ee_devices (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_id uuid NOT NULL,
  public_key_jwk jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, device_id),
  CONSTRAINT chat_e2ee_devices_public_key_shape CHECK (
    public_key_jwk ->> 'kty' = 'EC'
    AND public_key_jwk ->> 'crv' = 'P-256'
    AND jsonb_typeof(public_key_jwk -> 'x') = 'string'
    AND jsonb_typeof(public_key_jwk -> 'y') = 'string'
    AND NOT (public_key_jwk ? 'd')
  )
);

CREATE INDEX IF NOT EXISTS idx_chat_e2ee_devices_last_seen
  ON public.chat_e2ee_devices (user_id, last_seen_at DESC);

ALTER TABLE public.chat_e2ee_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.chat_e2ee_devices FROM anon, authenticated;
GRANT ALL ON TABLE public.chat_e2ee_devices TO service_role;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS encrypted_payload jsonb;

COMMENT ON COLUMN public.chat_messages.encrypted_payload IS
  'Opaque client-side encrypted payload for two-member personal chats. Never contains plaintext message content.';

-- Encrypted rows must not accidentally retain a second plaintext copy. A
-- trigger is used instead of a CHECK so mixed-version enforcement can also
-- consult room/device state.
CREATE OR REPLACE FUNCTION public.enforce_personal_message_e2ee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_count integer;
  keyed_member_count integer;
BEGIN
  SELECT count(*) INTO member_count
  FROM public.chat_room_members
  WHERE room_id = NEW.room_id;

  IF NEW.encrypted_payload IS NOT NULL THEN
    IF member_count <> 2 THEN
      RAISE EXCEPTION 'encrypted personal messages require a two-member room'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.text_content IS NOT NULL
       OR NEW.media_url IS NOT NULL
       OR NEW.correction_payload IS NOT NULL
       OR NEW.correction_request_payload IS NOT NULL
       OR NEW.status_reply_payload IS NOT NULL THEN
      RAISE EXCEPTION 'encrypted messages cannot persist plaintext content'
        USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
  END IF;

  -- Mixed-version rollout: plaintext remains possible until both members have
  -- enrolled at least one E2EE device. Once both have, supported personal
  -- message types cannot silently downgrade to plaintext, including from an
  -- older client.
  IF member_count = 2 AND NEW.message_type IN (
    'text',
    'voice',
    'correction',
    'doodle',
    'sticker',
    'correction_request',
    'status_reply',
    'view_once_media'
  ) THEN
    SELECT count(DISTINCT member.user_id) INTO keyed_member_count
    FROM public.chat_room_members AS member
    WHERE member.room_id = NEW.room_id
      AND EXISTS (
        SELECT 1
        FROM public.chat_e2ee_devices AS device
        WHERE device.user_id = member.user_id
      );

    IF keyed_member_count = 2 THEN
      RAISE EXCEPTION 'personal message encryption required'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_personal_message_e2ee ON public.chat_messages;
CREATE TRIGGER trg_enforce_personal_message_e2ee
BEFORE INSERT OR UPDATE OF encrypted_payload, text_content, media_url,
  correction_payload, correction_request_payload, status_reply_payload
ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.enforce_personal_message_e2ee();

REVOKE ALL ON FUNCTION public.enforce_personal_message_e2ee() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_personal_message_e2ee() TO service_role;

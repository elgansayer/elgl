-- Direct-message E2EE storage for #1195.
-- Private device keys never leave the client. The backend stores only public
-- P-256 keys plus per-message ciphertext/key envelopes.

CREATE TABLE IF NOT EXISTS public.chat_e2ee_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_id uuid NOT NULL,
  public_key_jwk jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT chat_e2ee_devices_user_device_unique UNIQUE (user_id, device_id),
  CONSTRAINT chat_e2ee_devices_public_key_shape CHECK (
    public_key_jwk->>'kty' = 'EC'
    AND public_key_jwk->>'crv' = 'P-256'
    AND jsonb_typeof(public_key_jwk->'x') = 'string'
    AND jsonb_typeof(public_key_jwk->'y') = 'string'
    AND NOT (public_key_jwk ? 'd')
  )
);

CREATE INDEX IF NOT EXISTS idx_chat_e2ee_devices_active_user
  ON public.chat_e2ee_devices (user_id, created_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.chat_e2ee_devices ENABLE ROW LEVEL SECURITY;

-- Device-key discovery is deliberately backend mediated because public keys
-- reveal account/device relationships. The service-role client verifies room
-- membership before returning keys to a participant.
REVOKE ALL ON TABLE public.chat_e2ee_devices FROM anon, authenticated;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS encryption_version smallint,
  ADD COLUMN IF NOT EXISTS encrypted_payload text,
  ADD COLUMN IF NOT EXISTS encryption_iv text,
  ADD COLUMN IF NOT EXISTS encryption_envelopes jsonb;

ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_e2ee_shape;

ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_e2ee_shape CHECK (
    (
      encryption_version IS NULL
      AND encrypted_payload IS NULL
      AND encryption_iv IS NULL
      AND encryption_envelopes IS NULL
    )
    OR (
      encryption_version = 1
      AND message_type = 'encrypted'
      AND text_content IS NULL
      AND media_url IS NULL
      AND encrypted_payload IS NOT NULL
      AND encryption_iv IS NOT NULL
      AND jsonb_typeof(encryption_envelopes) = 'array'
      AND jsonb_array_length(encryption_envelopes) BETWEEN 2 AND 20
    )
  ) NOT VALID;

ALTER TABLE public.chat_messages
  VALIDATE CONSTRAINT chat_messages_e2ee_shape;

COMMENT ON TABLE public.chat_e2ee_devices IS
  'Public device keys for direct-chat E2EE. Private keys remain on client devices.';
COMMENT ON COLUMN public.chat_messages.encrypted_payload IS
  'Base64url AES-256-GCM ciphertext. Plaintext is intentionally unavailable to the server.';
COMMENT ON COLUMN public.chat_messages.encryption_envelopes IS
  'Per-device wrapped message keys for active devices in the direct conversation.';

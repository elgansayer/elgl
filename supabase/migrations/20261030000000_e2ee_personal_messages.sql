-- Migration: End-to-end encryption for personal messages
-- Adds encryption metadata columns to chat_messages and creates user_e2ee_keys table

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS encryption_iv TEXT,
  ADD COLUMN IF NOT EXISTS encryption_sender_key_id TEXT;

COMMENT ON COLUMN public.chat_messages.is_encrypted IS 'Indicates whether the message content is end-to-end encrypted.';
COMMENT ON COLUMN public.chat_messages.encryption_iv IS 'Base64-encoded initialisation vector used for AES-GCM encryption.';
COMMENT ON COLUMN public.chat_messages.encryption_sender_key_id IS 'Identifier or device fingerprint for the sender cryptographic key.';

CREATE TABLE IF NOT EXISTS public.user_e2ee_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL DEFAULT 'default',
    public_key JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_device_e2ee_key UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_e2ee_keys_user_id ON public.user_e2ee_keys(user_id);

COMMENT ON TABLE public.user_e2ee_keys IS 'Stores public cryptographic keys for users to enable end-to-end encrypted direct messaging.';

ALTER TABLE public.user_e2ee_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_e2ee_keys_select ON public.user_e2ee_keys;
CREATE POLICY user_e2ee_keys_select
  ON public.user_e2ee_keys
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS user_e2ee_keys_insert_own ON public.user_e2ee_keys;
CREATE POLICY user_e2ee_keys_insert_own
  ON public.user_e2ee_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_e2ee_keys_update_own ON public.user_e2ee_keys;
CREATE POLICY user_e2ee_keys_update_own
  ON public.user_e2ee_keys
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_e2ee_keys_delete_own ON public.user_e2ee_keys;
CREATE POLICY user_e2ee_keys_delete_own
  ON public.user_e2ee_keys
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.chat_room_e2ee_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    encrypted_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_chat_room_user_e2ee_key UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_room_e2ee_keys_room_id ON public.chat_room_e2ee_keys(room_id);

COMMENT ON TABLE public.chat_room_e2ee_keys IS 'Stores per-user encrypted room key material for direct chat end-to-end encryption.';

ALTER TABLE public.chat_room_e2ee_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_room_e2ee_keys_select_member ON public.chat_room_e2ee_keys;
CREATE POLICY chat_room_e2ee_keys_select_member
  ON public.chat_room_e2ee_keys
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.chat_room_members member
      WHERE member.room_id = chat_room_e2ee_keys.room_id
        AND member.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS chat_room_e2ee_keys_insert_member ON public.chat_room_e2ee_keys;
CREATE POLICY chat_room_e2ee_keys_insert_member
  ON public.chat_room_e2ee_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.chat_room_members member
      WHERE member.room_id = chat_room_e2ee_keys.room_id
        AND member.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS chat_room_e2ee_keys_update_member ON public.chat_room_e2ee_keys;
CREATE POLICY chat_room_e2ee_keys_update_member
  ON public.chat_room_e2ee_keys
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_room_members member
      WHERE member.room_id = chat_room_e2ee_keys.room_id
        AND member.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.chat_room_members member
      WHERE member.room_id = chat_room_e2ee_keys.room_id
        AND member.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS chat_room_e2ee_keys_delete_member ON public.chat_room_e2ee_keys;
CREATE POLICY chat_room_e2ee_keys_delete_member
  ON public.chat_room_e2ee_keys
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.chat_room_members member
      WHERE member.room_id = chat_room_e2ee_keys.room_id
        AND member.user_id = auth.uid()
    )
  );

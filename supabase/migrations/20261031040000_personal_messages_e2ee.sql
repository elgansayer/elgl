-- Add encrypted content columns to chat_messages for personal conversations
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS encrypted_payload TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chat_messages_encrypted_payload_consistency'
          AND conrelid = 'public.chat_messages'::regclass
    ) THEN
        ALTER TABLE public.chat_messages
            ADD CONSTRAINT chat_messages_encrypted_payload_consistency
            CHECK (
                (
                    is_encrypted
                    AND encrypted_payload IS NOT NULL
                    AND encrypted_payload LIKE 'e2ee:v1:%'
                )
                OR (NOT is_encrypted AND encrypted_payload IS NULL)
            );
    END IF;
END
$$;

COMMENT ON COLUMN public.chat_messages.is_encrypted IS 'True when the message content is encrypted before storage and delivery';
COMMENT ON COLUMN public.chat_messages.encrypted_payload IS 'Armoured ciphertext and IV envelope for encrypted personal message content';

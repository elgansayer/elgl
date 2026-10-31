-- Durable, retryable voice-message transcription state.
-- Existing readers remain compatible because every new field is additive.

ALTER TABLE public.chat_messages
    ADD COLUMN IF NOT EXISTS voice_transcript TEXT,
    ADD COLUMN IF NOT EXISTS voice_transcription_status TEXT NOT NULL DEFAULT 'not_requested',
    ADD COLUMN IF NOT EXISTS voice_transcription_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS voice_transcription_requested_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS voice_transcription_last_attempt_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS voice_transcription_next_retry_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS voice_transcribed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS voice_transcription_error_code VARCHAR(64);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chat_messages_voice_transcription_status_check'
          AND conrelid = 'public.chat_messages'::regclass
    ) THEN
        ALTER TABLE public.chat_messages
            ADD CONSTRAINT chat_messages_voice_transcription_status_check
            CHECK (
                voice_transcription_status IN (
                    'not_requested',
                    'pending',
                    'processing',
                    'ready',
                    'empty',
                    'failed',
                    'unavailable'
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chat_messages_voice_transcription_attempts_check'
          AND conrelid = 'public.chat_messages'::regclass
    ) THEN
        ALTER TABLE public.chat_messages
            ADD CONSTRAINT chat_messages_voice_transcription_attempts_check
            CHECK (voice_transcription_attempts >= 0);
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS chat_messages_voice_transcription_queue_idx
    ON public.chat_messages (
        voice_transcription_status,
        voice_transcription_next_retry_at,
        voice_transcription_requested_at
    )
    WHERE voice_transcription_status IN ('pending', 'failed');

COMMENT ON COLUMN public.chat_messages.voice_transcript IS
    'Speech-to-text result for a voice message. It follows the parent message retention and deletion lifecycle.';
COMMENT ON COLUMN public.chat_messages.voice_transcription_status IS
    'Durable voice transcription worker state.';
COMMENT ON COLUMN public.chat_messages.voice_transcription_error_code IS
    'Non-sensitive machine-readable failure category. Never stores transcript or provider response content.';

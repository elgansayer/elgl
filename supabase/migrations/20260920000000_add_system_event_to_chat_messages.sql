-- Persist system events in conversation history. A system row has no user
-- sender, while every user-authored row retains the existing sender contract.
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS system_event JSONB;
ALTER TABLE public.chat_messages ALTER COLUMN sender_id DROP NOT NULL;

ALTER TABLE public.chat_messages
    DROP CONSTRAINT IF EXISTS chat_messages_sender_system_event_check;
ALTER TABLE public.chat_messages
    ADD CONSTRAINT chat_messages_sender_system_event_check CHECK (
        (
            message_type = 'system'
            AND sender_id IS NULL
            AND jsonb_typeof(system_event) = 'object'
            AND system_event ? 'type'
            AND jsonb_typeof(system_event -> 'type') = 'string'
        )
        OR (
            message_type <> 'system'
            AND sender_id IS NOT NULL
            AND system_event IS NULL
        )
    ) NOT VALID;

ALTER TABLE public.chat_messages
    VALIDATE CONSTRAINT chat_messages_sender_system_event_check;

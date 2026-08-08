-- Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id TEXT NOT NULL,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    message_type VARCHAR(50) NOT NULL DEFAULT 'text',
    text_content TEXT,
    media_url TEXT,
    correction_payload JSONB,
    correction_request_payload JSONB,
    status_reply_payload JSONB,
    system_event JSONB,
    contact_payload JSONB,
    is_read BOOLEAN NOT NULL DEFAULT false,
    is_view_once BOOLEAN NOT NULL DEFAULT false,
    viewed_at TIMESTAMPTZ,
    reply_to_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
    original_text TEXT,
    translated_text TEXT,
    detected_language VARCHAR(10),
    deleted_for_user_ids UUID[] DEFAULT NULL,
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'read')),
    is_edited BOOLEAN NOT NULL DEFAULT false,
    edited_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_room_id_idx ON public.chat_messages (room_id, created_at ASC);
CREATE INDEX IF NOT EXISTS chat_messages_sender_id_idx ON public.chat_messages (sender_id);
CREATE INDEX IF NOT EXISTS chat_messages_text_content_trgm_idx ON public.chat_messages USING GIN (text_content gin_trgm_ops);

-- Create favourites table
CREATE TABLE IF NOT EXISTS public.favourites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL DEFAULT 'message',
    item_payload JSONB NOT NULL DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS favourites_user_id_idx ON public.favourites (user_id, created_at DESC);

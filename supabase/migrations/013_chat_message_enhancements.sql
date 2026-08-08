-- Add columns to chat_messages
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_deleted_for_sender BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_deleted_for_everyone BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_forwarded BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'read'));
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_view_once BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;

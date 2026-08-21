-- Add gift_payload JSONB column to chat_messages for inline gift animations
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS gift_payload JSONB;
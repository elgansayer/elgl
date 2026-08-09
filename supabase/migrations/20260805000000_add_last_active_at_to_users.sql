-- Add last_active_at column to users table for streak tracking and login history
ALTER TABLE IF EXISTS public.users
    ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- Create login_history table for admin session tracking
CREATE TABLE IF NOT EXISTS public.login_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_history_user_id_idx ON public.login_history (user_id);
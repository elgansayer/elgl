-- Add email column to users table (needed for password reset lookup)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;

-- Create password_reset_tokens table for secure password reset flow
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_token_idx ON public.password_reset_tokens (token);
CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_idx ON public.password_reset_tokens (expires_at);
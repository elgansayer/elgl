-- Password Reset Tokens table
-- Supports the forgot-password flow with time-limited, single-use reset tokens.

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token
    ON public.password_reset_tokens (token);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
    ON public.password_reset_tokens (user_id);

-- Service role access only - tokens are sensitive and should not be exposed to clients.
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage password reset tokens"
    ON public.password_reset_tokens
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
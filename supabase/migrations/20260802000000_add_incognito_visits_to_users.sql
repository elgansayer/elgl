-- Add incognito_visits (VIP-only profile visiting privacy toggle) to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS incognito_visits BOOLEAN NOT NULL DEFAULT false;

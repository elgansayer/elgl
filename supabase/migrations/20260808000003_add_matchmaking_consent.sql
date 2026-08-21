-- Migration: Add matchmaking_consent for GDPR compliance
-- Fixes #2290: GDPR audit and data scrubbing for Matchmaking Algorithm
--
-- Adds an explicit consent column that users must opt into before appearing
-- in matchmaking/recommendation results.  This is separate from
-- privacy_hide_from_search and satisfies GDPR Article 7 (conditions for
-- consent) and Article 22 (automated individual decision-making).
--
-- The column defaults to FALSE for new and existing users -- existing users
-- must explicitly opt in via privacy settings.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS matchmaking_consent BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.matchmaking_consent IS
    'GDPR consent for automated matchmaking recommendations.  Must be true for a user to appear in recommendation results.  Separate from privacy_hide_from_search.';

-- Add index for efficient filtering in matchmaking queries
CREATE INDEX IF NOT EXISTS idx_users_matchmaking_consent
    ON public.users (matchmaking_consent)
    WHERE matchmaking_consent = true;

-- Migration: Review RLS policies for Discovery Map
-- Fixes #2274: Audit and strengthen Row Level Security policies for tables
-- used by the Discovery Map feature (search, filter, language-pair matching,
-- spotlight, audio-intro feed, and location-based partner discovery).
--
-- The NestJS backend authenticates with the service_role key (bypasses RLS).
-- These policies are defence-in-depth (OWASP A01: Broken Access Control).

-- ── 1. users: SELECT policy audit ────────────────────────────────────────
-- The Discovery Map is the heaviest consumer of the users table: every search
-- endpoint (partners, audio-intros, language-pair, spotlight, recent-native-
-- speakers, search-by-location) reads user profiles via the service_role key.
--
-- The existing `users_select_authenticated` policy (migration 009) allows ANY
-- authenticated user to SELECT any user row via the anon/authenticated key.
-- This is intentionally broad: user profiles must be readable for chat, room
-- listings, moment authors, and other social features.  The backend enforces
-- `privacy_hide_from_search` filtering, block lists, and VIP spoofing
-- server-side in DiscoveryService.
--
-- No changes needed to the SELECT policy.  The column-sensitive restrictions
-- (coins_balance, is_admin, etc.) are enforced by `users_update_own` and the
-- sensitive-columns trigger; SELECT does not expose those columns through the
-- API-layer DTOs, which only project safe profile fields.
--
-- The backend's `users_update_admin` policy is separately covered in
-- migration 20260807110437_review_rls_admin_moderation.sql.

COMMENT ON POLICY users_select_authenticated ON public.users IS
    'Intentionally broad -- allows profile lookups for chat, rooms, and moments.  The Discovery Map backend (service_role) applies privacy_hide_from_search, block lists, and VIP spoofing in DiscoveryService.';

-- ── 2. blocks / user_blocks: audit ───────────────────────────────────────
-- DiscoveryService.getBlockedAndBlockerIds queries both tables via
-- SafetyService.  Policies are already in place:
--   blocks: blocks_select_own, blocks_insert_own, blocks_delete_own
--   user_blocks: user_blocks_select_own, user_blocks_insert_own, user_blocks_delete_own
-- These correctly scope read/write access to the authenticated user's own
-- block relationships.  No changes needed.

COMMENT ON POLICY blocks_select_own ON public.blocks IS
    'Supports Discovery Map block-list filtering via SafetyService.getBlockedAndBlockerIds.';
COMMENT ON POLICY user_blocks_select_own ON public.user_blocks IS
    'Supports Discovery Map block-list filtering via SafetyService.getBlockedAndBlockerIds.';

-- ── 3. user_interests / interest_vocabulary: audit ───────────────────────
-- DiscoveryService uses these indirectly through recommendations and interest
-- filtering.  Policies were reviewed in migration 20260807152902
-- (review_rls_matchmaking).  No changes needed.

-- ── 4. search_nearby_users function: security reaffirmation ──────────────
-- This SECURITY DEFINER function is the primary query engine for location-
-- based discovery (DiscoveryService.searchPartners with latitude/longitude).
-- It bypasses RLS by design to perform efficient PostGIS proximity filtering
-- and already applies privacy_hide_from_search checks internally.
-- Reviewed and documented in migration 20260807152902.  No changes needed.

COMMENT ON FUNCTION public.search_nearby_users IS
    'SECURITY DEFINER -- Discovery Map primary spatial query.  Bypasses RLS for PostGIS performance; applies privacy_hide_from_search internally.  DiscoveryService adds block-list filtering, VIP spoofing, and advanced filters server-side.';

-- ── 5. favourites: audit ────────────────────────────────────────────────
-- Used by DiscoveryService.searchPartners when filter partner relations.
-- Policies exist: favourites_select_own, favourites_insert_own,
-- favourites_delete_own.  No changes needed.

-- ── 6. No new policies required ──────────────────────────────────────────
-- All tables used by the Discovery Map feature path already have appropriate
-- RLS policies in place.  The backend enforces all additional access-control
-- logic (blocks, privacy, VIP spoofing, proficiency filtering, age range
-- filtering) at the application layer via DiscoveryService and SafetyService.
--
-- Tables touched by Discovery Map and their RLS status:
--   users          -- users_select_authenticated, users_update_own, users_update_admin
--   blocks         -- blocks_select_own, blocks_insert_own, blocks_delete_own
--   user_blocks    -- user_blocks_select_own, user_blocks_insert_own, user_blocks_delete_own
--   user_interests -- user_interests_select_own, user_interests_insert_own, user_interests_delete_own
--   interest_vocabulary -- interest_vocabulary_select_authenticated
--   favourites     -- favourites_select_own, favourites_insert_own, favourites_delete_own
--   user_follows   -- user_follows_select_authenticated, user_follows_insert_own, user_follows_delete_own
--   audio_rooms    -- audio_rooms_select_authenticated, audio_rooms_insert_own, audio_rooms_update_own
--
-- Functions:
--   search_nearby_users -- SECURITY DEFINER (reviewed, no changes)
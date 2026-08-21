-- Migration: Optimise database indices for Virtual Coin Economy.
-- Issue #2418: Adds missing indices for high-frequency query patterns
-- and creates sticker_packs / user_sticker_packs tables with proper indices.
--
-- Query patterns analysed from economy.service.ts, escrow.service.ts,
-- and privacy.service.ts.

-- ── 1. Create sticker_packs and user_sticker_packs tables ──────────────────
-- These are referenced extensively in economy.service.ts and
-- privacy.service.ts but were never created by a migration.

CREATE TABLE IF NOT EXISTS public.sticker_packs (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    cost_coins INTEGER NOT NULL,
    is_animated BOOLEAN DEFAULT false,
    sticker_urls TEXT[] DEFAULT '{}',
    animation_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_sticker_packs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    pack_id VARCHAR(50) NOT NULL REFERENCES public.sticker_packs(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, pack_id)
);

-- Seed default sticker packs so the storefront is never empty.
INSERT INTO public.sticker_packs (id, name, cost_coins, is_animated, sticker_urls, animation_url) VALUES
    ('stk_pack_1', 'Happy Corgi Pack', 50, false, ARRAY['assets/stickers/happy.png', 'assets/stickers/laugh.png', 'assets/stickers/love.png'], NULL),
    ('stk_pack_2', 'Rainbow Unicorns', 200, true, ARRAY['assets/stickers/unicorn-gallop.webm', 'assets/stickers/unicorn-sparkle.webm'], 'assets/animations/unicorn.json'),
    ('stk_pack_3', 'Study Buddies', 100, false, ARRAY['assets/stickers/book.png', 'assets/stickers/pencil.png', 'assets/stickers/backpack.png'], NULL),
    ('stk_pack_4', 'Golden Dragons', 500, true, ARRAY['assets/stickers/dragon-fire.webm', 'assets/stickers/dragon-fly.webm'], 'assets/animations/dragon.json'),
    ('stk_pack_5', 'Party Animals', 150, true, ARRAY['assets/stickers/dog-dance.webm', 'assets/stickers/cat-party.webm', 'assets/stickers/bird-dj.webm'], 'assets/animations/party.json'),
    ('stk_pack_6', 'Chill Vibes', 80, false, ARRAY['assets/stickers/coffee.png', 'assets/stickers/sunset.png', 'assets/stickers/hammock.png'], NULL),
    ('stk_pack_7', 'Foodie Fun', 120, false, ARRAY['assets/stickers/pizza.png', 'assets/stickers/sushi.png', 'assets/stickers/taco.png'], NULL),
    ('stk_pack_8', 'Travel Stamps', 180, false, ARRAY['assets/stickers/passport.png', 'assets/stickers/suitcase.png', 'assets/stickers/camera.png'], NULL)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Indices for sticker_packs catalog queries ─────────────────────────
-- EconomyService.getStickerPacks() sorts by cost_coins ASC.
CREATE INDEX IF NOT EXISTS idx_sticker_packs_cost_coins
    ON public.sticker_packs (cost_coins ASC);

-- ── 3. Indices for user_sticker_packs ownership lookups ──────────────────
-- EconomyService.getStickerPacks() queries pack_id WHERE user_id = $1.
-- The UNIQUE(user_id, pack_id) constraint already creates a composite index
-- on (user_id, pack_id), which covers this lookup pattern.  An additional
-- index on (pack_id) helps the privacy-service deletion query.
CREATE INDEX IF NOT EXISTS idx_user_sticker_packs_pack_id
    ON public.user_sticker_packs (pack_id);

-- ── 4. Index for virtual_gifts catalog ordering ──────────────────────────
-- EconomyService.getCatalog() uses ORDER BY cost_coins ASC.
CREATE INDEX IF NOT EXISTS idx_virtual_gifts_cost_coins
    ON public.virtual_gifts (cost_coins ASC);

-- ── 5. Indices for gift_transactions ─────────────────────────────────────
-- sendGift() writes gift_transactions; the Centrifugo broadcast publishes
-- to the recipient and room channels.  The following indices support
-- gift-history views and analytics without sequential scans.

-- Sender gift history (most common user-facing query).
CREATE INDEX IF NOT EXISTS idx_gift_transactions_sender_created
    ON public.gift_transactions (sender_id, created_at DESC);

-- Receiver gift history (user checks gifts they received).
CREATE INDEX IF NOT EXISTS idx_gift_transactions_receiver_created
    ON public.gift_transactions (receiver_id, created_at DESC);

-- The existing gift_transactions_room_idx covers (room_id, created_at DESC)
-- for the live room gift feed.

-- ── 6. Indices for coin_purchases ────────────────────────────────────────
-- purchaseCoins() queries by (user_id, receipt_token) and (transaction_id).
-- Existing indices: idx_coin_purchases_user_id (user_id), idx_coin_purchases_receipt_token
-- (receipt_token), idx_coin_purchases_transaction_id_unique (transaction_id).

-- Purchase history for a user sorted by recency.
CREATE INDEX IF NOT EXISTS idx_coin_purchases_user_created
    ON public.coin_purchases (user_id, created_at DESC);

-- Audit / reporting queries by status (pending/completed/refunded).
CREATE INDEX IF NOT EXISTS idx_coin_purchases_status
    ON public.coin_purchases (status, created_at DESC);

-- ── 7. Partial index for coin leaderboard ────────────────────────────────
-- Top-N coin holders query: SELECT id, display_name, coins_balance
-- FROM users ORDER BY coins_balance DESC LIMIT N.
-- A partial index excludes users with 0 coins (the vast majority) to keep
-- the index small.
CREATE INDEX IF NOT EXISTS idx_users_coins_balance_desc
    ON public.users (coins_balance DESC)
    WHERE coins_balance > 0;

-- ── 8. Index for expired escrow cleanup query ────────────────────────────
-- cleanupExpiredEscrows() queries:
--   SELECT id, payer_id, amount_coins FROM escrow_transactions
--   WHERE status = 'held' AND created_at < $threshold LIMIT N
-- The existing idx_escrow_transactions_expires covers (expires_at, payer_id)
-- WHERE status = 'held'.  Add a composite for the status + created_at
-- pattern used in the cleanup scan.
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_status_created
    ON public.escrow_transactions (status, created_at)
    WHERE status = 'held';

-- ── 9. Enable RLS on new sticker tables ──────────────────────────────────
ALTER TABLE public.sticker_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sticker_packs ENABLE ROW LEVEL SECURITY;

-- sticker_packs is a read-only catalogue for authenticated users.
CREATE POLICY sticker_packs_select_authenticated ON public.sticker_packs
    FOR SELECT TO authenticated USING (true);

-- user_sticker_packs: users can read their own unlocks; service_role writes.
CREATE POLICY user_sticker_packs_select_own ON public.user_sticker_packs
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Note: INSERT is handled by the backend (service_role), which bypasses RLS.
-- DELETE for account closure is also service_role-only.

-- ── 10. Add CHECK constraint for sticker_packs.cost_coins ────────────────
ALTER TABLE public.sticker_packs
    ADD CONSTRAINT sticker_packs_cost_coins_positive CHECK (cost_coins > 0) NOT VALID;
ALTER TABLE public.sticker_packs
    VALIDATE CONSTRAINT sticker_packs_cost_coins_positive;
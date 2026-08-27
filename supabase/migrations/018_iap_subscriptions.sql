-- Apple App Store Server Notifications & Google Play RTDN subscription state.
--
-- Backed by `AppleNotificationService`/`GooglePlayNotificationService`
-- (backend/src/monetisation/), which upsert into these tables when a signed
-- webhook notification is received, and read from `google_play_purchases` to
-- resolve a Play `purchaseToken` back to a `user_id` for renewal/expiry
-- events. Without these tables the webhook handlers 500 on every call.

CREATE TABLE IF NOT EXISTS public.apple_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    original_transaction_id TEXT NOT NULL UNIQUE,
    transaction_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    expires_date TIMESTAMPTZ,
    purchase_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS apple_subscriptions_user_id_idx ON public.apple_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS public.google_play_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    purchase_token TEXT NOT NULL UNIQUE,
    subscription_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS google_play_purchases_user_id_idx ON public.google_play_purchases (user_id);

-- Keep `updated_at` current on every upsert from the webhook handlers.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS apple_subscriptions_set_updated_at ON public.apple_subscriptions;
CREATE TRIGGER apple_subscriptions_set_updated_at
    BEFORE UPDATE ON public.apple_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS google_play_purchases_set_updated_at ON public.google_play_purchases;
CREATE TRIGGER google_play_purchases_set_updated_at
    BEFORE UPDATE ON public.google_play_purchases
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: only the backend's service_role writes here (see AGENTS.md "API
-- First"); authenticated users may read their own subscription rows so a
-- future "Manage Subscription" UI can query them directly if needed.
ALTER TABLE public.apple_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY apple_subscriptions_service_role ON public.apple_subscriptions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY apple_subscriptions_select_own ON public.apple_subscriptions
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.google_play_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY google_play_purchases_service_role ON public.google_play_purchases
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY google_play_purchases_select_own ON public.google_play_purchases
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

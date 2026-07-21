-- Add coins balance and developer API key column to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS coins_balance INTEGER NOT NULL DEFAULT 50;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS developer_api_key VARCHAR(100) NULL;

CREATE TABLE IF NOT EXISTS public.virtual_gifts (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(10) NOT NULL,
    cost_coins INTEGER NOT NULL,
    animation_type VARCHAR(50) NOT NULL
);

INSERT INTO public.virtual_gifts (id, name, icon, cost_coins, animation_type) VALUES
('rose', 'Language Rose', '🌹', 10, 'fade'),
('coffee', 'Study Coffee', '☕', 25, 'bounce'),
('trophy', 'Fluency Trophy', '🏆', 100, 'confetti'),
('rocket', 'Rocket Boost', '🚀', 250, 'fly'),
('crown', 'Royal Crown', '👑', 500, 'fireworks')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.gift_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    gift_id VARCHAR(50) NOT NULL REFERENCES public.virtual_gifts(id) ON DELETE RESTRICT,
    room_id UUID NULL REFERENCES public.audio_rooms(id) ON DELETE SET NULL,
    coins_spent INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.safety_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reported_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reason VARCHAR(255) NOT NULL,
    details TEXT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blocker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocker_idx ON public.user_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS gift_transactions_room_idx ON public.gift_transactions (room_id, created_at DESC);

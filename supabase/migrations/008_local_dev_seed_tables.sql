CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    avatar TEXT NOT NULL,
    is_online BOOLEAN NOT NULL DEFAULT false,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_rooms_pinned_idx
    ON public.chat_rooms (is_pinned DESC, created_at ASC);

CREATE TABLE IF NOT EXISTS public.developer_metrics (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    total_api_calls_today INTEGER NOT NULL DEFAULT 0,
    avg_latency_ms INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.developer_diagnostic_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('POSTGIS', 'CENTRIFUGO', 'REDIS', 'LIVEKIT')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('info', 'success', 'warn')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS developer_diagnostic_logs_created_idx
    ON public.developer_diagnostic_logs (created_at DESC);

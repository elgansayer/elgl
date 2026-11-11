-- Migration: class replays with adaptive HLS/DASH playback
--
-- On-the-fly transcoding is delegated to Cloudflare Stream, which encodes the
-- source recording into adaptive HLS and DASH renditions. This table stores the
-- durable lookup and access-control metadata; feature records reference a
-- provider video identity instead of a caller-supplied playback URL.
--
-- The migration is additive and replay safe: every object uses IF NOT EXISTS and
-- no existing migration is rewritten.

CREATE TABLE IF NOT EXISTS public.class_replays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    room_id UUID REFERENCES public.audio_rooms(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
    provider TEXT NOT NULL DEFAULT 'cloudflare_stream',
    provider_video_id TEXT,
    source_url TEXT,
    hls_url TEXT,
    dash_url TEXT,
    download_url TEXT,
    thumbnail_url TEXT,
    duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    failure_code TEXT,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_attempt_at TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nullable unique columns permit many unscoped replays while preventing the
-- same room or provider video from being registered twice.
CREATE UNIQUE INDEX IF NOT EXISTS class_replays_room_unique_idx
    ON public.class_replays (room_id);
CREATE UNIQUE INDEX IF NOT EXISTS class_replays_provider_video_unique_idx
    ON public.class_replays (provider_video_id);
CREATE INDEX IF NOT EXISTS class_replays_host_created_idx
    ON public.class_replays (host_id, created_at DESC);
CREATE INDEX IF NOT EXISTS class_replays_status_queue_idx
    ON public.class_replays (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS class_replays_expiry_idx
    ON public.class_replays (expires_at)
    WHERE expires_at IS NOT NULL;

-- The NestJS backend uses the service role and enforces participant access in
-- the policy layer. Authenticated clients must never read provider identifiers
-- or playback URLs directly, so RLS is enabled with no permissive policy.
ALTER TABLE public.class_replays ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.class_replays IS
    'Adaptive class replay metadata. Playback URLs are resolved by the backend for authorised participants only.';
COMMENT ON COLUMN public.class_replays.source_url IS
    'Private ingest source retained for retries; never returned to clients.';
COMMENT ON COLUMN public.class_replays.provider_video_id IS
    'Opaque media provider identity; never returned to clients.';

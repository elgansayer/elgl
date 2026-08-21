-- Sanitized operational events for the dedicated admin console.
-- This is not a raw log sink: stack traces, request bodies, credentials and
-- arbitrary metadata must never be persisted here.
CREATE TABLE IF NOT EXISTS public.admin_operational_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
    category TEXT NOT NULL CHECK (char_length(category) BETWEEN 1 AND 80),
    message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
    correlation_id TEXT NULL CHECK (correlation_id IS NULL OR char_length(correlation_id) <= 128),
    source TEXT NULL CHECK (source IS NULL OR char_length(source) <= 80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_operational_events_created_at ON public.admin_operational_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_operational_events_severity_created_at ON public.admin_operational_events(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_operational_events_category_created_at ON public.admin_operational_events(category, created_at DESC);
ALTER TABLE public.admin_operational_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_operational_events FROM anon, authenticated;

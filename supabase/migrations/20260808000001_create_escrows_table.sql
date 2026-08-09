-- Create escrows table for escrow payment system (#2393)
-- Optimised with indices for the primary query patterns in EscrowService

CREATE TABLE IF NOT EXISTS public.escrows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'released', 'refunded', 'disputed', 'cancelled')),
    description TEXT NOT NULL DEFAULT '',
    service_type VARCHAR(30) NOT NULL DEFAULT 'other'
        CHECK (service_type IN ('lesson', 'language_exchange', 'proofreading', 'translation', 'other')),
    dispute_reason TEXT,
    dispute_evidence TEXT,
    admin_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for sender-centric queries: listUserEscrows filters by sender_id + status,
-- ordered by created_at DESC. Composite covers both filtering and sort.
CREATE INDEX IF NOT EXISTS idx_escrows_sender_id_created_at
    ON public.escrows (sender_id, created_at DESC);

-- Index for receiver-centric queries: symmetrical to sender index for OR-based lookups
CREATE INDEX IF NOT EXISTS idx_escrows_receiver_id_created_at
    ON public.escrows (receiver_id, created_at DESC);

-- Index for status filtering (admin dashboards, dispute resolution, status-filtered lists)
CREATE INDEX IF NOT EXISTS idx_escrows_status
    ON public.escrows (status);

-- Composite indices for the common combined filter + sort pattern:
-- "WHERE (sender_id = X OR receiver_id = X) AND status = ? ORDER BY created_at DESC"
-- Postgres can bitmap-merge sender + receiver indices and then filter by status,
-- but these composites avoid the extra bitmap merge when status is specified.
CREATE INDEX IF NOT EXISTS idx_escrows_sender_status_created
    ON public.escrows (sender_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_escrows_receiver_status_created
    ON public.escrows (receiver_id, status, created_at DESC);

-- Trigger to auto-update updated_at on every row modification
DROP TRIGGER IF EXISTS escrows_set_updated_at ON public.escrows;
CREATE TRIGGER escrows_set_updated_at
    BEFORE UPDATE ON public.escrows
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
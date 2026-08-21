-- Support exact newer audit filters with newest-first pagination.
-- Existing actor/action/target/correlation indexes are retained.

CREATE INDEX IF NOT EXISTS admin_audit_events_outcome_created_idx
    ON public.admin_audit_events(outcome, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_events_capability_created_idx
    ON public.admin_audit_events(capability_key, created_at DESC)
    WHERE capability_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS admin_audit_events_reason_created_idx
    ON public.admin_audit_events(reason_code, created_at DESC)
    WHERE reason_code IS NOT NULL;

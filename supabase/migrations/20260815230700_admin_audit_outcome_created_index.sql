create index if not exists admin_audit_events_outcome_created_idx
  on public.admin_audit_events (outcome, created_at desc);

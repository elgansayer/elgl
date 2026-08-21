create index if not exists admin_audit_events_capability_created_idx
  on public.admin_audit_events (capability_key, created_at desc)
  where capability_key is not null;

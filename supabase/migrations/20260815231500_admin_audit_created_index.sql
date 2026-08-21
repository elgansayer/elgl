create index if not exists admin_audit_events_created_idx
  on public.admin_audit_events (created_at desc);

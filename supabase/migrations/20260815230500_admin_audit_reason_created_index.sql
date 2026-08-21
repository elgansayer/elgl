create index if not exists admin_audit_events_reason_created_idx
  on public.admin_audit_events (reason_code, created_at desc)
  where reason_code is not null;

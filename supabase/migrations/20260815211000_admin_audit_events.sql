create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.users(id) on delete restrict,
  action text not null check (char_length(action) between 3 and 160),
  capability_key text null references public.admin_capabilities(key) on delete restrict,
  target_type text null check (target_type is null or char_length(target_type) between 1 and 80),
  target_id text null check (target_id is null or char_length(target_id) between 1 and 200),
  reason_code text null check (reason_code is null or char_length(reason_code) between 1 and 80),
  outcome text not null check (outcome in ('success', 'denied', 'failed')),
  correlation_id text not null check (char_length(correlation_id) between 1 and 160),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_events_actor_created_idx
  on public.admin_audit_events (actor_user_id, created_at desc);
create index if not exists admin_audit_events_action_created_idx
  on public.admin_audit_events (action, created_at desc);
create index if not exists admin_audit_events_target_created_idx
  on public.admin_audit_events (target_type, target_id, created_at desc);
create index if not exists admin_audit_events_correlation_idx
  on public.admin_audit_events (correlation_id);

alter table public.admin_audit_events enable row level security;

revoke all on table public.admin_audit_events from anon, authenticated;

comment on table public.admin_audit_events is
  'Append-only server-authored audit trail for privileged administrative access and actions. Application code must not update or delete rows.';
comment on column public.admin_audit_events.metadata is
  'Sanitized allow-listed operational metadata only. Never store credentials, tokens, cookies, authorization headers or arbitrary request bodies.';

-- Configurable retention for the append-only administrative audit trail.
-- The application records audit rows continuously and opportunistically invokes
-- prune_admin_audit_events at most once per process per day. The policy itself
-- is backend-only so browser clients cannot shorten retention or erase history.

create table if not exists public.admin_audit_retention_policy (
  id smallint primary key default 1 check (id = 1),
  retention_days integer not null default 365
    check (retention_days between 30 and 3650),
  updated_at timestamptz not null default now()
);

insert into public.admin_audit_retention_policy (id, retention_days)
values (1, 365)
on conflict (id) do nothing;

alter table public.admin_audit_retention_policy enable row level security;
revoke all on table public.admin_audit_retention_policy from anon, authenticated;

comment on table public.admin_audit_retention_policy is
  'Backend-only singleton policy controlling admin_audit_events retention. Default 365 days; permitted range 30-3650 days.';

create or replace function public.prune_admin_audit_events()
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  policy_days integer;
  deleted_rows bigint;
begin
  select retention_days
    into policy_days
    from public.admin_audit_retention_policy
   where id = 1;

  policy_days := coalesce(policy_days, 365);

  delete from public.admin_audit_events
   where created_at < now() - make_interval(days => policy_days);

  get diagnostics deleted_rows = row_count;
  return deleted_rows;
end;
$$;

revoke all on function public.prune_admin_audit_events() from public, anon, authenticated;
grant execute on function public.prune_admin_audit_events() to service_role;

comment on function public.prune_admin_audit_events() is
  'Deletes admin audit events older than the backend-only configured retention period and returns the number of rows removed.';

-- Issue #3653: privacy-minimized IP reputation investigation and temporary blocking.
-- Raw lookup IPs are never copied into these control tables. The only persisted
-- network identifiers are operator-created CIDRs needed to enforce or exempt a rule.

insert into public.admin_capabilities (key, description)
values
  ('security.network.read', 'Inspect bounded network abuse signals and impact previews'),
  ('security.network.manage', 'Create and revoke temporary network blocks and allowlist exceptions')
on conflict (key) do update set description = excluded.description;

insert into public.admin_role_capabilities (role_id, capability_key)
select role.id, capability.key
from public.admin_roles as role
cross join (values ('security.network.read'), ('security.network.manage')) as capability(key)
where role.key = 'super_admin'
on conflict (role_id, capability_key) do nothing;

create table if not exists public.admin_network_blocks (
  id uuid primary key default gen_random_uuid(),
  network cidr not null,
  scope text not null check (scope in ('all', 'auth', 'write')),
  reason_code text not null,
  operator_note text null check (operator_note is null or char_length(operator_note) <= 1000),
  expires_at timestamptz not null,
  created_by uuid not null references public.users(id) on delete restrict,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz null,
  revoked_by uuid null references public.users(id) on delete set null,
  check (expires_at > created_at),
  unique (created_by, idempotency_key)
);

create index if not exists idx_admin_network_blocks_active
  on public.admin_network_blocks (expires_at desc)
  where revoked_at is null;

create table if not exists public.admin_network_allowlist (
  id uuid primary key default gen_random_uuid(),
  network cidr not null,
  reason text not null check (char_length(reason) between 3 and 240),
  expires_at timestamptz null,
  created_by uuid not null references public.users(id) on delete restrict,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz null,
  revoked_by uuid null references public.users(id) on delete set null,
  check (expires_at is null or expires_at > created_at),
  unique (created_by, idempotency_key)
);

create index if not exists idx_admin_network_allowlist_active
  on public.admin_network_allowlist (expires_at desc nulls first)
  where revoked_at is null;

alter table public.admin_network_blocks enable row level security;
alter table public.admin_network_allowlist enable row level security;
revoke all on public.admin_network_blocks from anon, authenticated;
revoke all on public.admin_network_allowlist from anon, authenticated;

create or replace function public.try_parse_inet(value text)
returns inet
language plpgsql
immutable
strict
as $$
begin
  return value::inet;
exception when others then
  return null;
end;
$$;

revoke all on function public.try_parse_inet(text) from public, anon, authenticated;
grant execute on function public.try_parse_inet(text) to service_role;

create or replace function public.is_network_request_blocked(
  p_ip inet,
  p_scope text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when p_scope not in ('all', 'auth', 'write') then false
    when exists (
      select 1
      from public.admin_network_allowlist a
      where a.revoked_at is null
        and (a.expires_at is null or a.expires_at > now())
        and p_ip <<= a.network
    ) then false
    else exists (
      select 1
      from public.admin_network_blocks b
      where b.revoked_at is null
        and b.expires_at > now()
        and p_ip <<= b.network
        and (
          b.scope = 'all'
          or b.scope = p_scope
          or (p_scope = 'auth' and b.scope = 'write')
        )
    )
  end;
$$;

revoke all on function public.is_network_request_blocked(inet, text) from public, anon, authenticated;
grant execute on function public.is_network_request_blocked(inet, text) to service_role;

create or replace function public.admin_network_reputation(p_ip inet)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with observations as (
    select lh.user_id, lh.created_at
    from public.login_history lh
    where public.try_parse_inet(lh.ip_address) = p_ip
      and lh.created_at >= now() - interval '7 days'
  ), stats as (
    select
      count(*) filter (where created_at >= now() - interval '24 hours')::int as events_24h,
      count(*)::int as events_7d,
      count(distinct user_id)::int as accounts_7d,
      max(created_at) as latest_seen_at
    from observations
  ), controls as (
    select
      exists (
        select 1 from public.admin_network_allowlist a
        where a.revoked_at is null
          and (a.expires_at is null or a.expires_at > now())
          and p_ip <<= a.network
      ) as allowlisted,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', b.id,
          'network', b.network::text,
          'scope', b.scope,
          'expires_at', b.expires_at
        ) order by b.expires_at)
        from public.admin_network_blocks b
        where b.revoked_at is null
          and b.expires_at > now()
          and p_ip <<= b.network
      ), '[]'::jsonb) as active_blocks
  )
  select jsonb_build_object(
    'network', set_masklen(p_ip, case when family(p_ip) = 4 then 24 else 64 end)::cidr::text,
    'risk_level', case
      when jsonb_array_length(c.active_blocks) > 0 or s.accounts_7d >= 10 or s.events_24h >= 50 then 'high'
      when s.accounts_7d >= 4 or s.events_24h >= 15 then 'medium'
      else 'low'
    end,
    'signals', to_jsonb(array_remove(array[
      case when s.events_24h >= 15 then 'elevated_login_volume' end,
      case when s.accounts_7d >= 4 then 'multi_account_network' end,
      case when jsonb_array_length(c.active_blocks) > 0 then 'active_network_block' end,
      case when c.allowlisted then 'allowlisted_network' end
    ], null)),
    'login_events_24h', s.events_24h,
    'login_events_7d', s.events_7d,
    'unique_accounts_7d', s.accounts_7d,
    'latest_seen_at', s.latest_seen_at,
    'allowlisted', c.allowlisted,
    'active_blocks', c.active_blocks
  )
  from stats s cross join controls c;
$$;

revoke all on function public.admin_network_reputation(inet) from public, anon, authenticated;
grant execute on function public.admin_network_reputation(inet) to service_role;

create or replace function public.admin_network_block_impact(p_cidr cidr)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with observations as (
    select lh.user_id
    from public.login_history lh
    where lh.created_at >= now() - interval '30 days'
      and public.try_parse_inet(lh.ip_address) <<= p_cidr
  ), stats as (
    select
      count(*)::int as observed_login_events_30d,
      count(distinct user_id)::int as observed_accounts_30d
    from observations
  ), conflicts as (
    select coalesce(jsonb_agg(a.network::text order by masklen(a.network)), '[]'::jsonb) as networks
    from public.admin_network_allowlist a
    where a.revoked_at is null
      and (a.expires_at is null or a.expires_at > now())
      and a.network && p_cidr
  )
  select jsonb_build_object(
    'network', p_cidr::text,
    'observed_login_events_30d', s.observed_login_events_30d,
    'observed_accounts_30d', s.observed_accounts_30d,
    'allowlist_conflicts', c.networks
  )
  from stats s cross join conflicts c;
$$;

revoke all on function public.admin_network_block_impact(cidr) from public, anon, authenticated;
grant execute on function public.admin_network_block_impact(cidr) to service_role;

create or replace function public.prune_admin_network_controls()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count integer := 0;
  current_count integer := 0;
begin
  delete from public.admin_network_blocks
  where coalesce(revoked_at, expires_at) < now() - interval '180 days';
  get diagnostics current_count = row_count;
  deleted_count := deleted_count + current_count;

  delete from public.admin_network_allowlist
  where revoked_at is not null
    and revoked_at < now() - interval '180 days';
  get diagnostics current_count = row_count;
  deleted_count := deleted_count + current_count;

  return deleted_count;
end;
$$;

revoke all on function public.prune_admin_network_controls() from public, anon, authenticated;
grant execute on function public.prune_admin_network_controls() to service_role;

comment on table public.admin_network_blocks is
  'Temporary scoped network controls created by authorized security admins. Retained for 180 days after expiry/revocation for auditability.';
comment on table public.admin_network_allowlist is
  'Explicit network exceptions that override temporary abuse blocks. Direct client access is prohibited.';

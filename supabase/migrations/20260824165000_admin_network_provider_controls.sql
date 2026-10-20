-- Issue #3654: privacy-minimized ASN / hosting-provider abuse trends and controls.
-- Observations are aggregated by ASN/day/scope. Raw IP addresses and user IDs are not
-- copied into these tables. Provider names are optional edge-supplied infrastructure
-- metadata and are never accepted from an untrusted client request.

create table if not exists public.admin_network_provider_daily_signals (
  observed_on date not null default current_date,
  asn bigint not null check (asn between 1 and 4294967295),
  provider_name text not null default 'unknown'
    check (char_length(provider_name) between 1 and 120),
  is_hosting_provider boolean not null default false,
  scope text not null check (scope in ('auth', 'write')),
  request_count bigint not null default 0 check (request_count >= 0),
  last_seen_at timestamptz not null default now(),
  primary key (observed_on, asn, scope)
);

create index if not exists idx_admin_network_provider_signals_asn_date
  on public.admin_network_provider_daily_signals (asn, observed_on desc);

create table if not exists public.admin_network_provider_blocks (
  id uuid primary key default gen_random_uuid(),
  asn bigint not null check (asn between 1 and 4294967295),
  provider_snapshot text null check (
    provider_snapshot is null or char_length(provider_snapshot) between 1 and 120
  ),
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

create index if not exists idx_admin_network_provider_blocks_active
  on public.admin_network_provider_blocks (asn, expires_at desc)
  where revoked_at is null;

create table if not exists public.admin_network_provider_allowlist (
  id uuid primary key default gen_random_uuid(),
  asn bigint not null check (asn between 1 and 4294967295),
  provider_snapshot text null check (
    provider_snapshot is null or char_length(provider_snapshot) between 1 and 120
  ),
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

create index if not exists idx_admin_network_provider_allowlist_active
  on public.admin_network_provider_allowlist (asn, expires_at desc nulls first)
  where revoked_at is null;

alter table public.admin_network_provider_daily_signals enable row level security;
alter table public.admin_network_provider_blocks enable row level security;
alter table public.admin_network_provider_allowlist enable row level security;

revoke all on public.admin_network_provider_daily_signals from anon, authenticated;
revoke all on public.admin_network_provider_blocks from anon, authenticated;
revoke all on public.admin_network_provider_allowlist from anon, authenticated;

create or replace function public.record_network_provider_signal(
  p_asn bigint,
  p_provider text,
  p_is_hosting boolean,
  p_scope text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_provider text;
begin
  if p_asn is null or p_asn < 1 or p_asn > 4294967295 then
    raise exception 'invalid ASN';
  end if;
  if p_scope not in ('auth', 'write') then
    raise exception 'invalid provider signal scope';
  end if;

  normalized_provider := left(coalesce(nullif(btrim(p_provider), ''), 'unknown'), 120);

  insert into public.admin_network_provider_daily_signals (
    observed_on,
    asn,
    provider_name,
    is_hosting_provider,
    scope,
    request_count,
    last_seen_at
  ) values (
    current_date,
    p_asn,
    normalized_provider,
    coalesce(p_is_hosting, false),
    p_scope,
    1,
    now()
  )
  on conflict (observed_on, asn, scope) do update
  set
    provider_name = case
      when excluded.provider_name <> 'unknown' then excluded.provider_name
      else public.admin_network_provider_daily_signals.provider_name
    end,
    is_hosting_provider =
      public.admin_network_provider_daily_signals.is_hosting_provider
      or excluded.is_hosting_provider,
    request_count = public.admin_network_provider_daily_signals.request_count + 1,
    last_seen_at = greatest(
      public.admin_network_provider_daily_signals.last_seen_at,
      excluded.last_seen_at
    );
end;
$$;

revoke all on function public.record_network_provider_signal(bigint, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.record_network_provider_signal(bigint, text, boolean, text)
  to service_role;

create or replace function public.is_network_provider_request_blocked(
  p_asn bigint,
  p_scope text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when p_asn is null or p_asn < 1 or p_asn > 4294967295 then false
    when p_scope not in ('all', 'auth', 'write') then false
    when exists (
      select 1
      from public.admin_network_provider_allowlist a
      where a.asn = p_asn
        and a.revoked_at is null
        and (a.expires_at is null or a.expires_at > now())
    ) then false
    else exists (
      select 1
      from public.admin_network_provider_blocks b
      where b.asn = p_asn
        and b.revoked_at is null
        and b.expires_at > now()
        and (
          b.scope = 'all'
          or b.scope = p_scope
          or (p_scope = 'auth' and b.scope = 'write')
        )
    )
  end;
$$;

revoke all on function public.is_network_provider_request_blocked(bigint, text)
  from public, anon, authenticated;
grant execute on function public.is_network_provider_request_blocked(bigint, text)
  to service_role;

create or replace function public.admin_network_provider_reputation(p_asn bigint)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with observations as (
    select *
    from public.admin_network_provider_daily_signals s
    where s.asn = p_asn
      and s.observed_on >= current_date - 29
  ), stats as (
    select
      coalesce(sum(request_count) filter (where observed_on = current_date), 0)::bigint
        as requests_today,
      coalesce(sum(request_count) filter (where observed_on >= current_date - 6), 0)::bigint
        as requests_7d,
      count(distinct observed_on) filter (where observed_on >= current_date - 6)::int
        as active_days_7d,
      max(last_seen_at) as latest_seen_at,
      coalesce(bool_or(is_hosting_provider), false) as is_hosting_provider
    from observations
  ), latest as (
    select provider_name
    from observations
    order by last_seen_at desc
    limit 1
  ), controls as (
    select
      exists (
        select 1
        from public.admin_network_provider_allowlist a
        where a.asn = p_asn
          and a.revoked_at is null
          and (a.expires_at is null or a.expires_at > now())
      ) as allowlisted,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', b.id,
          'scope', b.scope,
          'expires_at', b.expires_at
        ) order by b.expires_at)
        from public.admin_network_provider_blocks b
        where b.asn = p_asn
          and b.revoked_at is null
          and b.expires_at > now()
      ), '[]'::jsonb) as active_blocks
  )
  select jsonb_build_object(
    'asn', p_asn,
    'provider', coalesce((select provider_name from latest), 'unknown'),
    'is_hosting_provider', s.is_hosting_provider,
    'risk_level', case
      when jsonb_array_length(c.active_blocks) > 0
        or s.requests_7d >= 500
        or (s.is_hosting_provider and s.requests_7d >= 100) then 'high'
      when s.is_hosting_provider or s.requests_7d >= 100 or s.active_days_7d >= 6 then 'medium'
      else 'low'
    end,
    'signals', to_jsonb(array_remove(array[
      case when s.is_hosting_provider then 'hosting_provider' end,
      case when s.requests_today >= 50 then 'elevated_daily_activity' end,
      case when s.requests_7d >= 100 then 'elevated_weekly_activity' end,
      case when s.active_days_7d >= 6 then 'sustained_activity' end,
      case when jsonb_array_length(c.active_blocks) > 0 then 'active_provider_block' end,
      case when c.allowlisted then 'allowlisted_provider' end
    ], null)),
    'requests_today', s.requests_today,
    'requests_7d', s.requests_7d,
    'active_days_7d', s.active_days_7d,
    'latest_seen_at', s.latest_seen_at,
    'allowlisted', c.allowlisted,
    'active_blocks', c.active_blocks
  )
  from stats s cross join controls c;
$$;

revoke all on function public.admin_network_provider_reputation(bigint)
  from public, anon, authenticated;
grant execute on function public.admin_network_provider_reputation(bigint)
  to service_role;

create or replace function public.admin_network_provider_block_impact(p_asn bigint)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with observations as (
    select *
    from public.admin_network_provider_daily_signals s
    where s.asn = p_asn
      and s.observed_on >= current_date - 29
  ), stats as (
    select
      coalesce(sum(request_count), 0)::bigint as observed_requests_30d,
      count(distinct observed_on)::int as observed_days_30d,
      coalesce(bool_or(is_hosting_provider), false) as is_hosting_provider,
      max(last_seen_at) as latest_seen_at
    from observations
  ), latest as (
    select provider_name
    from observations
    order by last_seen_at desc
    limit 1
  )
  select jsonb_build_object(
    'asn', p_asn,
    'provider', coalesce((select provider_name from latest), 'unknown'),
    'is_hosting_provider', s.is_hosting_provider,
    'observed_requests_30d', s.observed_requests_30d,
    'observed_days_30d', s.observed_days_30d,
    'latest_seen_at', s.latest_seen_at,
    'allowlisted', exists (
      select 1
      from public.admin_network_provider_allowlist a
      where a.asn = p_asn
        and a.revoked_at is null
        and (a.expires_at is null or a.expires_at > now())
    )
  )
  from stats s;
$$;

revoke all on function public.admin_network_provider_block_impact(bigint)
  from public, anon, authenticated;
grant execute on function public.admin_network_provider_block_impact(bigint)
  to service_role;

create or replace function public.prune_admin_network_provider_controls()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count integer := 0;
  current_count integer := 0;
begin
  delete from public.admin_network_provider_daily_signals
  where observed_on < current_date - 90;
  get diagnostics current_count = row_count;
  deleted_count := deleted_count + current_count;

  delete from public.admin_network_provider_blocks
  where coalesce(revoked_at, expires_at) < now() - interval '180 days';
  get diagnostics current_count = row_count;
  deleted_count := deleted_count + current_count;

  delete from public.admin_network_provider_allowlist
  where revoked_at is not null
    and revoked_at < now() - interval '180 days';
  get diagnostics current_count = row_count;
  deleted_count := deleted_count + current_count;

  return deleted_count;
end;
$$;

revoke all on function public.prune_admin_network_provider_controls()
  from public, anon, authenticated;
grant execute on function public.prune_admin_network_provider_controls()
  to service_role;

comment on table public.admin_network_provider_daily_signals is
  'Privacy-minimized daily ASN abuse aggregates. Contains no raw IP addresses or user IDs and is retained for at most 90 days.';
comment on table public.admin_network_provider_blocks is
  'Temporary scoped ASN controls created by authorized security admins. Retained for 180 days after expiry/revocation for auditability.';
comment on table public.admin_network_provider_allowlist is
  'Explicit ASN exceptions overriding temporary provider blocks. Direct client access is prohibited.';

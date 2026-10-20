-- Issue #3613: temporary, additive emergency throttles for abusive networks.
--
-- These controls can only make traffic stricter. They do not alter or bypass the
-- application-specific rate-limit policies enforced by feature guards. Raw IP
-- addresses are never persisted here; only operator-created CIDRs are retained.

create table if not exists public.admin_network_rate_limits (
  id uuid primary key default gen_random_uuid(),
  network cidr not null,
  scope text not null check (scope in ('all', 'auth', 'write')),
  max_requests integer not null check (max_requests between 1 and 300),
  window_seconds integer not null check (window_seconds between 10 and 3600),
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

create index if not exists idx_admin_network_rate_limits_active
  on public.admin_network_rate_limits (expires_at desc, scope)
  where revoked_at is null;

create index if not exists idx_admin_network_rate_limits_network
  on public.admin_network_rate_limits using gist (network inet_ops)
  where revoked_at is null;

alter table public.admin_network_rate_limits enable row level security;
revoke all on public.admin_network_rate_limits from anon, authenticated;

-- Return the strictest currently active policy that applies to a request. Rate
-- is compared before raw request count so, for example, 10/hour is correctly
-- treated as stricter than 5/10-seconds. More-specific CIDRs win later ties.
create or replace function public.admin_network_rate_limit_for_ip(
  p_ip inet,
  p_scope text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select jsonb_build_object(
      'id', r.id,
      'network', r.network::text,
      'scope', r.scope,
      'max_requests', r.max_requests,
      'window_seconds', r.window_seconds,
      'reason_code', r.reason_code,
      'expires_at', r.expires_at,
      'created_at', r.created_at,
      'revoked_at', r.revoked_at
    )
    from public.admin_network_rate_limits r
    where p_scope in ('all', 'auth', 'write')
      and r.revoked_at is null
      and r.expires_at > now()
      and r.network >>= p_ip
      and (r.scope = 'all' or r.scope = p_scope)
    order by
      (r.max_requests::numeric / r.window_seconds::numeric) asc,
      r.max_requests asc,
      masklen(r.network) desc,
      r.created_at desc
    limit 1
  ), '{}'::jsonb);
$$;

revoke all on function public.admin_network_rate_limit_for_ip(inet, text)
  from public, anon, authenticated;
grant execute on function public.admin_network_rate_limit_for_ip(inet, text)
  to service_role;

-- Extend the existing network-control retention job so expired/revoked throttle
-- records follow the same 180-day operational-audit retention policy.
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

  delete from public.admin_network_rate_limits
  where coalesce(revoked_at, expires_at) < now() - interval '180 days';
  get diagnostics current_count = row_count;
  deleted_count := deleted_count + current_count;

  return deleted_count;
end;
$$;

revoke all on function public.prune_admin_network_controls()
  from public, anon, authenticated;
grant execute on function public.prune_admin_network_controls() to service_role;

comment on table public.admin_network_rate_limits is
  'Temporary additive network throttles created by authorized security admins. Raw lookup IPs are not persisted. Records are retained for 180 days after expiry/revocation for auditability.';

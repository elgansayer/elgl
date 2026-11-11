-- Issue #2031: flagged Moments for the moderation dashboard and time-bounded,
-- reversible account suspensions.
--
-- 1. public.reports gains a soft reference to the flagged Moment plus a bounded
--    text snapshot. The reference is deliberately NOT a foreign key: an author who
--    deletes a flagged Moment must not erase the evidence or drop the case from the
--    review queue. The report row itself still cascades with the reported user.
-- 2. public.account_suspensions records an enforceable restriction with an expiry,
--    a reason code, an idempotency key and lift metadata. It is written only by the
--    backend service role; browser roles receive no policy and no privileges.
--
-- Expected query patterns:
--   * moderation queue: reports WHERE reported_moment_id IS NOT NULL AND status = $1
--     ORDER BY created_at DESC (partial index reports_flagged_moment_queue_idx);
--   * authentication boundary: account_suspensions WHERE user_id = $1 AND
--     lifted_at IS NULL AND expires_at > now() (partial index below).
--
-- Retention: suspension rows cascade away with the user. Every issue and lift is
-- also recorded in the append-only admin_audit_events trail.

alter table public.reports
  add column if not exists reported_moment_id uuid null,
  add column if not exists reported_moment_excerpt text null;

alter table public.reports
  drop constraint if exists reports_moment_excerpt_length;
alter table public.reports
  add constraint reports_moment_excerpt_length
  check (reported_moment_excerpt is null or char_length(reported_moment_excerpt) <= 1000);

create index if not exists reports_flagged_moment_queue_idx
  on public.reports (status, created_at desc)
  where reported_moment_id is not null;

-- A reporter flags a given Moment once; a retried request resolves to the same case.
create unique index if not exists reports_one_flag_per_reporter_moment_idx
  on public.reports (reporter_id, reported_moment_id)
  where reported_moment_id is not null and reporter_id is not null;

-- Members may still insert their own reports directly through PostgREST, but the
-- Moment evidence is authored only by the backend: /safety/report verifies the
-- Moment exists and belongs to the reported member before writing these columns.
-- Without this constraint a reporter could insert a fabricated excerpt against
-- any member and have it presented to reviewers as captured evidence. The
-- service role bypasses RLS, so the API is unaffected.
drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports
  for insert to authenticated
  with check (
    auth.uid() = reporter_id
    and reported_moment_id is null
    and reported_moment_excerpt is null
  );

create table if not exists public.account_suspensions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  reason_code text not null check (
    reason_code in (
      'account_security',
      'policy_violation',
      'user_request',
      'legal_request',
      'fraud_or_abuse',
      'moderation_enforcement',
      'support_correction',
      'incident_response',
      'other_reviewed'
    )
  ),
  operator_note text null check (operator_note is null or char_length(operator_note) <= 1000),
  report_id uuid null references public.reports(id) on delete set null,
  issued_by uuid null references public.users(id) on delete set null,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  lifted_at timestamptz null,
  lifted_by uuid null references public.users(id) on delete set null,
  lift_reason_code text null check (
    lift_reason_code is null or lift_reason_code in (
      'account_security',
      'policy_violation',
      'user_request',
      'legal_request',
      'fraud_or_abuse',
      'moderation_enforcement',
      'support_correction',
      'incident_response',
      'other_reviewed'
    )
  ),
  lift_operator_note text null check (
    lift_operator_note is null or char_length(lift_operator_note) <= 1000
  ),
  check (expires_at > created_at),
  check ((lifted_at is null) = (lift_reason_code is null)),
  unique (issued_by, idempotency_key)
);

-- Serves the authentication-boundary lookup without scanning lifted history.
create index if not exists account_suspensions_active_idx
  on public.account_suspensions (user_id, expires_at desc)
  where lifted_at is null;

create index if not exists account_suspensions_user_history_idx
  on public.account_suspensions (user_id, created_at desc);

alter table public.account_suspensions enable row level security;
revoke all on public.account_suspensions from anon, authenticated;

-- History is append-only: an active row may be lifted exactly once and nothing else
-- may change. Foreign keys may be cleared (ON DELETE SET NULL fires an UPDATE) but
-- never repointed, so deleting an administrator or a report is not blocked.
create or replace function public.protect_account_suspension_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.reason_code is distinct from old.reason_code
     or new.operator_note is distinct from old.operator_note
     or new.idempotency_key is distinct from old.idempotency_key
     or new.created_at is distinct from old.created_at
     or new.expires_at is distinct from old.expires_at
     or (new.report_id is distinct from old.report_id and new.report_id is not null)
     or (new.issued_by is distinct from old.issued_by and new.issued_by is not null)
     or (
       old.lifted_at is not null
       and (
         new.lifted_at is distinct from old.lifted_at
         or new.lift_reason_code is distinct from old.lift_reason_code
         or new.lift_operator_note is distinct from old.lift_operator_note
         or (new.lifted_by is distinct from old.lifted_by and new.lifted_by is not null)
       )
     ) then
    raise exception 'account_suspensions history is append-only'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_account_suspension_history() from public, anon, authenticated;

drop trigger if exists account_suspensions_protect_history on public.account_suspensions;
create trigger account_suspensions_protect_history
  before update on public.account_suspensions
  for each row
  execute function public.protect_account_suspension_history();

alter table public.admin_audit_events
  add column if not exists operator_note text null;

alter table public.admin_audit_events
  drop constraint if exists admin_audit_events_operator_note_length;

alter table public.admin_audit_events
  add constraint admin_audit_events_operator_note_length
  check (operator_note is null or char_length(operator_note) <= 1000);

comment on column public.admin_audit_events.reason_code is
  'Structured administrative reason code. New privileged mutation endpoints should require one of the backend-approved codes.';
comment on column public.admin_audit_events.operator_note is
  'Optional private bounded operator context. Backend validation rejects obvious credentials/secrets; never copy arbitrary request bodies here.';

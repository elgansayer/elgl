-- Enforce the documented append-only audit boundary at the database layer.
-- Service-role clients bypass RLS, so UPDATE/DELETE must be rejected explicitly.

CREATE OR REPLACE FUNCTION public.prevent_admin_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_events is append-only'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_admin_audit_event_mutation() FROM PUBLIC, anon, authenticated;

drop trigger if exists admin_audit_events_append_only on public.admin_audit_events;
create trigger admin_audit_events_append_only
  before update or delete on public.admin_audit_events
  for each row
  execute function public.prevent_admin_audit_event_mutation();

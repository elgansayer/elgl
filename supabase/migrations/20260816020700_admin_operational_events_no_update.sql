-- Operational events are append-only except for explicit retention deletion.
-- Service-role clients bypass RLS, so UPDATE must be rejected explicitly while
-- DELETE remains available to the guarded retention function.

CREATE OR REPLACE FUNCTION public.prevent_admin_operational_event_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'admin_operational_events cannot be updated'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_admin_operational_event_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS admin_operational_events_no_update ON public.admin_operational_events;
CREATE TRIGGER admin_operational_events_no_update
  BEFORE UPDATE ON public.admin_operational_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_admin_operational_event_update();

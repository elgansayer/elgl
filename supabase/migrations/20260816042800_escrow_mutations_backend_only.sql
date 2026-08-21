-- Escrow mutations are implemented through the authenticated NestJS escrow API.
-- No current client code requires direct authenticated Supabase INSERT/UPDATE
-- access to public.escrows. Removing these policies prevents clients from
-- bypassing backend transition, balance, idempotency and audit rules.
--
-- Participant SELECT remains unchanged for compatibility. The backend uses the
-- service_role client and is not restricted by these authenticated policies.

DROP POLICY IF EXISTS escrows_insert_sender ON public.escrows;
DROP POLICY IF EXISTS escrows_update_participant ON public.escrows;

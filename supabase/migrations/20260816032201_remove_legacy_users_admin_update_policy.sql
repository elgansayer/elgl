-- Legacy dashboard RLS allowed any authenticated account with users.is_admin=true
-- to update arbitrary user rows directly through Supabase. That bypasses the
-- capability-gated and audited admin API (for example users.manage).
--
-- Backend administrative mutations use service_role and bypass RLS, so removing
-- this browser-facing policy does not affect approved admin API operations.
-- Existing restricted self-update policies remain in place for normal users.

DROP POLICY IF EXISTS users_update_admin ON public.users;

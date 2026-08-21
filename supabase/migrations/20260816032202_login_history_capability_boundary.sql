-- Keep sensitive cross-user login-history reads behind the audited admin API.
-- The original policy allowed any authenticated account with users.is_admin=true
-- to query another user's IP/user-agent history directly through Supabase,
-- bypassing the newer users.sessions.read capability and audit trail.
--
-- Authenticated users retain direct access to their own history. The NestJS
-- backend uses service_role and continues to perform capability-gated admin reads.

DROP POLICY IF EXISTS login_history_select_own_or_admin
  ON public.login_history;

CREATE POLICY login_history_select_own
  ON public.login_history
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

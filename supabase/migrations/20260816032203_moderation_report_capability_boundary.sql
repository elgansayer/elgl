-- Keep cross-user moderation report access behind the capability-gated backend.
-- Legacy policies granted authenticated users with users.is_admin=true direct
-- Supabase access, bypassing moderation.cases.read/manage and admin auditing.
--
-- Normal users retain the original ability to read and submit their own reports.
-- Backend moderation operations use service_role and remain unaffected by RLS.

DROP POLICY IF EXISTS reports_select_own ON public.reports;
CREATE POLICY reports_select_own ON public.reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS reports_insert_own ON public.reports;
CREATE POLICY reports_insert_own ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS reports_update_admin ON public.reports;
DROP POLICY IF EXISTS reports_delete_admin ON public.reports;

DROP POLICY IF EXISTS safety_reports_select_own ON public.safety_reports;
CREATE POLICY safety_reports_select_own ON public.safety_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS safety_reports_insert_own ON public.safety_reports;
CREATE POLICY safety_reports_insert_own ON public.safety_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS safety_reports_update_admin ON public.safety_reports;
DROP POLICY IF EXISTS safety_reports_delete_admin ON public.safety_reports;

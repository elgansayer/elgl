-- Keep privileged cross-user escrow access behind the backend authorization boundary.
-- Legacy RLS allowed any authenticated account with users.is_admin=true to read
-- and update arbitrary escrow rows directly through Supabase, bypassing audited
-- admin capabilities.
--
-- Participant behavior is intentionally preserved here for compatibility. A
-- separate hardening stage can narrow participant state transitions behind the
-- backend without mixing that behavioral change into this admin-boundary fix.

DROP POLICY IF EXISTS escrows_select_participant ON public.escrows;
CREATE POLICY escrows_select_participant ON public.escrows
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS escrows_update_participant ON public.escrows;
CREATE POLICY escrows_update_participant ON public.escrows
  FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Support newest-first administrative role-assignment investigations by grantor.
-- Bootstrap/system grants have NULL granted_by and are intentionally excluded.

CREATE INDEX IF NOT EXISTS idx_admin_user_roles_granted_by_granted_at
  ON public.admin_user_roles (granted_by, granted_at DESC)
  WHERE granted_by IS NOT NULL;

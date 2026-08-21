-- Support bounded newest-first admin role-assignment investigation.
-- Existing primary/user indexes remain useful for authorization lookups; these
-- composites target the read-only inventory's exact-filter + granted_at order.

CREATE INDEX IF NOT EXISTS idx_admin_user_roles_user_granted_at
    ON public.admin_user_roles(user_id, granted_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_user_roles_role_granted_at
    ON public.admin_user_roles(role_id, granted_at DESC);

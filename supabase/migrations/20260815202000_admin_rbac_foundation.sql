-- Admin RBAC foundation
-- Replaces hard-coded portal capabilities with persisted role assignments while
-- retaining users.is_admin as a coarse bootstrap/migration boundary.

CREATE TABLE IF NOT EXISTS public.admin_capabilities (
    key TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_role_capabilities (
    role_id UUID NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
    capability_key TEXT NOT NULL REFERENCES public.admin_capabilities(key) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, capability_key)
);

CREATE TABLE IF NOT EXISTS public.admin_user_roles (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
    granted_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NULL,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT admin_user_roles_expiry_after_grant CHECK (expires_at IS NULL OR expires_at > granted_at)
);

CREATE INDEX IF NOT EXISTS idx_admin_user_roles_user_id
    ON public.admin_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_user_roles_active_expiry
    ON public.admin_user_roles(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_role_capabilities_role_id
    ON public.admin_role_capabilities(role_id);

-- Privilege tables are backend-only. service_role bypasses RLS; authenticated
-- browser clients receive no direct table policy and therefore cannot enumerate
-- or mutate administrative privileges through Supabase.
ALTER TABLE public.admin_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_role_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_user_roles ENABLE ROW LEVEL SECURITY;

INSERT INTO public.admin_capabilities (key, description) VALUES
    ('users.read', 'Read bounded administrative user metadata'),
    ('users.manage', 'Perform approved user-management mutations'),
    ('moderation.cases.read', 'Read moderation cases and permitted evidence'),
    ('moderation.cases.manage', 'Create and update moderation cases and interventions'),
    ('audit.read', 'Read administrative audit events'),
    ('logs.read', 'Read sanitized application and operational logs'),
    ('system.health.read', 'Read administrative system-health information')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO public.admin_roles (key, name, description, is_system)
VALUES (
    'super_admin',
    'Super administrator',
    'Bootstrap system role containing every registered administrative capability.',
    true
)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_system = true,
    updated_at = now();

INSERT INTO public.admin_role_capabilities (role_id, capability_key)
SELECT r.id, c.key
FROM public.admin_roles r
CROSS JOIN public.admin_capabilities c
WHERE r.key = 'super_admin'
ON CONFLICT (role_id, capability_key) DO NOTHING;

-- Preserve existing administrators during rollout. Future privilege grants should
-- be made through admin_user_roles rather than by toggling users.is_admin alone.
INSERT INTO public.admin_user_roles (user_id, role_id, granted_by)
SELECT u.id, r.id, NULL
FROM public.users u
CROSS JOIN public.admin_roles r
WHERE u.is_admin = true
  AND r.key = 'super_admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

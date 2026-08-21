insert into public.admin_capabilities (key, description)
values (
  'users.sessions.read',
  'Read bounded, privacy-scrubbed user login/session history for authorized investigation'
)
on conflict (key) do update
set description = excluded.description;

insert into public.admin_role_capabilities (role_id, capability_key)
select role.id, 'users.sessions.read'
from public.admin_roles as role
where role.key = 'super_admin'
on conflict (role_id, capability_key) do nothing;

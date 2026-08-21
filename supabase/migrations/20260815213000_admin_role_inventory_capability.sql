insert into public.admin_capabilities (key, description)
values ('roles.read', 'Read administrative roles and their registered capability assignments')
on conflict (key) do update
set description = excluded.description;

insert into public.admin_role_capabilities (role_id, capability_key)
select role.id, 'roles.read'
from public.admin_roles as role
where role.key = 'super_admin'
on conflict (role_id, capability_key) do nothing;

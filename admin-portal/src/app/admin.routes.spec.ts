import { ADMIN_ROUTES } from './admin.routes';
import { AuditPageComponent } from './pages/audit-page.component';
import { LogsPageComponent } from './pages/logs-page.component';
import { ModerationPageComponent } from './pages/moderation-page.component';
import { RoleAssignmentsPageComponent } from './pages/role-assignments-page.component';
import { RolesPageComponent } from './pages/roles-page.component';
import { SystemHealthPageComponent } from './pages/system-health-page.component';
import { UserDetailPageComponent } from './pages/user-detail-page.component';
import { UsersPageComponent } from './pages/users-page.component';

describe('ADMIN_ROUTES', () => {
  it.each([
    ['users', UsersPageComponent, 'users.read'],
    ['users/:id', UserDetailPageComponent, 'users.read'],
    ['moderation', ModerationPageComponent, 'moderation.cases.read'],
    ['roles', RolesPageComponent, 'roles.read'],
    ['roles/assignments', RoleAssignmentsPageComponent, 'roles.read'],
    ['audit', AuditPageComponent, 'audit.read'],
    ['logs', LogsPageComponent, 'logs.read'],
    ['system', SystemHealthPageComponent, 'system.health.read'],
  ])(
    'maps /%s to the real page and required capability',
    (path, component, capability) => {
      const route = ADMIN_ROUTES.find((candidate) => candidate.path === path);

      expect(route).toBeDefined();
      expect(route?.component).toBe(component);
      expect(route?.canActivate).toHaveLength(1);
      expect(route?.data?.['capability']).toBe(capability);
    },
  );

  it('keeps the wildcard route as a safe dashboard redirect', () => {
    const wildcard = ADMIN_ROUTES.find((route) => route.path === '**');

    expect(wildcard).toEqual(
      expect.objectContaining({
        path: '**',
        redirectTo: '',
      }),
    );
  });
});

import { describe, expect, it } from 'vitest';
import { adminGuard } from '../guards/admin.guard';
import { adminRoutes } from './admin.routes';

describe('admin route fail-closed contract', () => {
  it('protects every /admin route with the real adminGuard', () => {
    const privilegedRoutes = adminRoutes.filter(
      (route) => route.path === 'admin' || route.path?.startsWith('admin/'),
    );

    expect(privilegedRoutes.length).toBeGreaterThan(0);

    for (const route of privilegedRoutes) {
      expect(route.canActivate, `${route.path} must fail closed behind adminGuard`).toContain(
        adminGuard,
      );
    }
  });

  it('keeps the developer dashboard outside the admin authorization boundary', () => {
    const developerRoute = adminRoutes.find((route) => route.path === 'developer');

    expect(developerRoute).toBeDefined();
    expect(developerRoute?.canActivate ?? []).not.toContain(adminGuard);
  });
});

import { describe, it, expect } from 'vitest';
import { routes } from './app.routes';
import { adminGuard } from './guards/admin.guard';

describe('App routes', () => {
  it('should export a non-empty route array', () => {
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThan(0);
  });

  it('should include the root redirect to ai-conversation', () => {
    const root = routes.find((r) => r.path === '');
    expect(root).toBeDefined();
    if (root) {
      expect(root.redirectTo).toBe('ai-conversation');
      expect(root.pathMatch).toBe('full');
    }
  });

  it('should include all expected paths', () => {
    const paths = routes.map((r) => r.path).filter((path): path is string => Boolean(path));
    const expected = [
      'home',
      'discovery',
      'proficiency',
      'moments',
      'chat',
      'chat/:id',
      'profile',
      'profile/:userId',
      'settings',
      'admin',
      'admin/moderation',
      'milestones',
      'study-buddy',
      'events',
      'events/calendar',
    ];
    for (const p of expected) {
      expect(paths).toContain(p);
    }
  });

  it('should use lazy loading for routes that have loadComponent defined', () => {
    const lazyRoutes = routes.filter((r) => r.path && r.loadComponent);
    expect(lazyRoutes.length).toBeGreaterThan(0);
    for (const r of lazyRoutes) {
      expect(typeof r.loadComponent).toBe('function');
    }
  });

  it('should NOT use eager component loading - all feature routes should be lazy', () => {
    const directRoutes = routes.filter((r) => r.path && r.component);
    expect(directRoutes.length).toBe(0);
  });

  it('should guard the admin route with adminGuard', () => {
    const admin = routes.find((r) => r.path === 'admin');
    expect(admin).toBeDefined();
    if (admin) {
      expect(admin.canActivate).toBeDefined();
      if (admin.canActivate) {
        expect(admin.canActivate).toContain(adminGuard);
      }
    }
  });

  it('should guard the admin/moderation route with adminGuard', () => {
    const moderation = routes.find((r) => r.path === 'admin/moderation');
    expect(moderation).toBeDefined();
    if (moderation) {
      expect(moderation.canActivate).toBeDefined();
      if (moderation.canActivate) {
        expect(moderation.canActivate).toContain(adminGuard);
      }
    }
  });

  it('should guard every admin feature route with the backend-backed adminGuard', () => {
    const expectedAdminPaths = [
      'admin',
      'admin/lessons',
      'admin/moderation',
      'admin/blocks',
      'admin/users',
    ];

    for (const path of expectedAdminPaths) {
      const route = routes.find((candidate) => candidate.path === path);
      expect(route, `missing route ${path}`).toBeDefined();
      expect(route?.canActivate, `missing admin guard on ${path}`).toContain(adminGuard);
    }
  });

  it('should lazy-load milestones component route', () => {
    const milestones = routes.find((r) => r.path === 'milestones');
    expect(milestones).toBeDefined();
    if (milestones) {
      expect(milestones.loadComponent).toBeDefined();
      expect(typeof milestones.loadComponent).toBe('function');
    }
  });
});

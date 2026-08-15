import { describe, expect, it } from 'vitest';
import { ADMIN_ROUTES } from './admin.routes';

describe('ADMIN_ROUTES', () => {
  it('protects privileged routes with their expected capabilities', () => {
    const capabilities = new Map(
      ADMIN_ROUTES.map((route) => [route.path, route.data?.['capability']]),
    );

    expect(capabilities.get('users')).toBe('users.read');
    expect(capabilities.get('users/:id')).toBe('users.read');
    expect(capabilities.get('moderation')).toBe('moderation.cases.read');
    expect(capabilities.get('roles')).toBe('roles.read');
    expect(capabilities.get('audit')).toBe('audit.read');
    expect(capabilities.get('logs')).toBe('logs.read');
    expect(capabilities.get('system')).toBe('system.health.read');
  });

  it('keeps authentication and denial routes outside capability gating', () => {
    for (const path of ['login', 'access-denied']) {
      const route = ADMIN_ROUTES.find((candidate) => candidate.path === path);
      expect(route).toBeDefined();
      expect(route?.canActivate).toBeUndefined();
    }
  });
});

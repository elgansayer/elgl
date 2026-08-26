import { describe, expect, it } from 'vitest';
import { settingsRoutes } from './settings.routes';

describe('settings block-management routes', () => {
  it('owns the settings-scoped block-management destination', () => {
    const route = settingsRoutes.find((candidate) => candidate.path === 'settings/blocks');

    expect(route).toBeDefined();
    expect(typeof route?.loadComponent).toBe('function');
    expect(route?.redirectTo).toBeUndefined();
  });

  it('keeps a settings-scoped compatibility alias without duplicating the component', () => {
    const route = settingsRoutes.find((candidate) => candidate.path === 'settings/blocked-users');

    expect(route?.redirectTo).toBe('settings/blocks');
    expect(route?.pathMatch).toBe('full');
    expect(route?.loadComponent).toBeUndefined();
  });
});

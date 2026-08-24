import { describe, expect, it } from 'vitest';
import { settingsRoutes } from './settings.routes';

describe('settings block-management routes', () => {
  it('exposes the privacy hub /blocks destination as a lazy route', () => {
    const route = settingsRoutes.find((candidate) => candidate.path === 'blocks');

    expect(route).toBeDefined();
    expect(typeof route?.loadComponent).toBe('function');
    expect(route?.redirectTo).toBeUndefined();
  });

  it('keeps a settings-scoped compatibility alias without duplicating the component', () => {
    const route = settingsRoutes.find((candidate) => candidate.path === 'settings/blocked-users');

    expect(route?.redirectTo).toBe('blocks');
    expect(route?.pathMatch).toBe('full');
    expect(route?.loadComponent).toBeUndefined();
  });
});

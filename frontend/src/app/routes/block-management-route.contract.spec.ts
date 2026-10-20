import { settingsRoutes } from './settings.routes';

describe('Block management route contract', () => {
  it('keeps the Privacy hub /blocks destination lazy-loaded and reachable', () => {
    const route = settingsRoutes.find((candidate) => candidate.path === 'settings/blocks');

    expect(route).toBeDefined();
    expect(route?.loadComponent).toBeTypeOf('function');
    expect(route?.redirectTo).toBeUndefined();
    expect(route?.title).toBe('Blocked Users - HelloTalk');
  });
});

import { describe, expect, it } from 'vitest';
import { learningRoutes } from './learning.routes';
import { settingsRoutes } from './settings.routes';

describe('language settings route ownership', () => {
  it('keeps the canonical interface-language screen in settings routes', () => {
    const route = settingsRoutes.find((candidate) => candidate.path === 'settings/language');

    expect(route).toBeDefined();
    expect(route?.loadComponent).toBeTypeOf('function');
    expect(route?.title).toBe('Language Settings - HelloTalk');
  });

  it('preserves the legacy /language entry point as a redirect', () => {
    const route = settingsRoutes.find((candidate) => candidate.path === 'language');

    expect(route).toMatchObject({
      redirectTo: 'settings/language',
      pathMatch: 'full',
    });
  });

  it('does not couple interface-language settings to study routes', () => {
    expect(learningRoutes.some((route) => route.path === 'language')).toBe(false);
    expect(learningRoutes.some((route) => route.path === 'settings/language')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { socialRoutes } from './social.routes';

describe('social route ownership', () => {
  it('matches the canonical visitors route before the dynamic profile route', () => {
    const visitorsIndex = socialRoutes.findIndex((route) => route.path === 'profile/visitors');
    const dynamicProfileIndex = socialRoutes.findIndex((route) => route.path === 'profile/:userId');

    expect(visitorsIndex).toBeGreaterThanOrEqual(0);
    expect(dynamicProfileIndex).toBeGreaterThan(visitorsIndex);
  });

  it('preserves the legacy visitors entry point as a compatibility redirect', () => {
    const route = socialRoutes.find((candidate) => candidate.path === 'visitors');

    expect(route).toMatchObject({
      redirectTo: 'profile/visitors',
      pathMatch: 'full',
    });
  });
});

import type { Route, Routes } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';

type IndexedRoute = {
  readonly path: string;
  readonly route: Route;
};

function collectRoutes(routeSet: Routes, parentPath = ''): IndexedRoute[] {
  return routeSet.flatMap((route) => {
    const path = [parentPath, route.path ?? ''].filter(Boolean).join('/');
    const current = { path, route };
    const children = route.children ? collectRoutes(route.children, path) : [];
    return [current, ...children];
  });
}

describe('standalone route lazy-loading contract', () => {
  const indexedRoutes = collectRoutes(routes);

  it('does not eagerly attach routed Angular components', () => {
    const eagerRoutes = indexedRoutes
      .filter(({ route }) => route.component !== undefined)
      .map(({ path }) => path);

    expect(eagerRoutes).toEqual([]);
  });

  it('keeps representative non-critical product surfaces behind dynamic loaders', () => {
    const nonCriticalPaths = [
      'community',
      'vocabulary',
      'discovery',
      'moments',
      'events',
      'settings',
      'chat',
    ];

    for (const path of nonCriticalPaths) {
      const match = indexedRoutes.find((entry) => entry.path === path);

      expect(match, `expected route ${path} to remain registered`).toBeDefined();
      expect(
        typeof match?.route.loadComponent === 'function' ||
          typeof match?.route.loadChildren === 'function',
        `expected route ${path} to be lazy loaded`,
      ).toBe(true);
    }
  });

  it('keeps redirects free of component loaders', () => {
    const redirectsWithComponents = indexedRoutes
      .filter(({ route }) => route.redirectTo !== undefined)
      .filter(
        ({ route }) =>
          route.component !== undefined ||
          route.loadComponent !== undefined ||
          route.loadChildren !== undefined,
      )
      .map(({ path }) => path);

    expect(redirectsWithComponents).toEqual([]);
  });
});

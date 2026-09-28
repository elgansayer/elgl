import type { Route } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { authRoutes } from './auth.routes';

function getRoute(path: string): Route {
  const route = authRoutes.find((candidate) => candidate.path === path);

  expect(route, `Expected public /${path} route`).toBeDefined();
  return route as Route;
}

describe('public legal routes', () => {
  it.each([
    ['terms', 'Terms of Service - HelloTalk'],
    ['privacy', 'Privacy Policy - HelloTalk'],
  ])('keeps /%s lazy-loaded and available before authentication', (path, title) => {
    const route = getRoute(path);

    expect(route.title).toBe(title);
    expect(route.loadComponent).toBeTypeOf('function');
    expect(route.redirectTo).toBeUndefined();
    expect(route.component).toBeUndefined();
    expect(route.canActivate).toBeUndefined();
    expect(route.canMatch).toBeUndefined();
  });

  it('keeps Terms and Privacy as separate canonical destinations', () => {
    const terms = getRoute('terms');
    const privacy = getRoute('privacy');

    expect(terms).not.toBe(privacy);
    expect(terms.path).toBe('terms');
    expect(privacy.path).toBe('privacy');
  });
});

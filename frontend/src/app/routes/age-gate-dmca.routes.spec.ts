import { Route } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { AgeGateComponent } from '../components/age-gate/age-gate.component';
import { CopyrightNoticesComponent } from '../components/copyright-notices/copyright-notices.component';
import { DmcaNoticeFormComponent } from '../components/dmca-notice-form/dmca-notice-form.component';
import { DmcaVerifyComponent } from '../components/dmca-verify/dmca-verify.component';
import { authRoutes } from './auth.routes';
import { settingsRoutes } from './settings.routes';

function find(routes: Route[], path: string): Route {
  const route = routes.find((candidate) => candidate.path === path);
  expect(route, `Expected /${path} route`).toBeDefined();
  if (!route) throw new Error(`missing route ${path}`);
  return route;
}

describe('age gate and copyright routes', () => {
  it.each([
    ['age-gate', AgeGateComponent],
    ['dmca', DmcaNoticeFormComponent],
    ['dmca/verify', DmcaVerifyComponent],
  ])('lazy-loads /%s without a route guard', async (path, component) => {
    const route = find(authRoutes, path);

    expect(route.title).toEqual(expect.stringContaining('HelloTalk'));
    expect(route.loadComponent).toBeTypeOf('function');
    expect(route.canActivate).toBeUndefined();
    expect(route.canMatch).toBeUndefined();
    expect(await route.loadComponent?.()).toBe(component);
  });

  it('serves the owner notices page from settings', async () => {
    const route = find(settingsRoutes, 'settings/copyright-notices');

    expect(route.loadComponent).toBeTypeOf('function');
    expect(await route.loadComponent?.()).toBe(CopyrightNoticesComponent);
  });

  it('keeps the dmca verification route ahead of nothing that could shadow it', () => {
    const paths = authRoutes.map((route) => route.path);
    expect(paths.filter((path) => path === 'dmca/verify')).toHaveLength(1);
    expect(paths.filter((path) => path === 'age-gate')).toHaveLength(1);
  });
});

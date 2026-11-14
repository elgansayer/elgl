import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { NotificationsController } from './notifications.controller';
import { UsersController } from '../users/users.controller';

interface RouteEntry {
  method: RequestMethod;
  path: string;
}

function routesOf(controller: object): RouteEntry[] {
  const prototype = controller as { prototype: Record<string, unknown> };
  const base = String(Reflect.getMetadata(PATH_METADATA, controller) ?? '');
  return Object.getOwnPropertyNames(prototype.prototype)
    .filter((name) => name !== 'constructor')
    .flatMap((name) => {
      const handler = prototype.prototype[name];
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as
        RequestMethod | undefined;
      if (method === undefined) return [];
      const path = String(Reflect.getMetadata(PATH_METADATA, handler) ?? '');
      const joined = `/${base}/${path}`.replace(/\/+/g, '/');
      return [{ method, path: joined === '/' ? joined : joined.replace(/\/$/, '') }];
    });
}

describe('notification preference route inventory', () => {
  it('exposes exactly one rich preference controller contract', () => {
    expect(routesOf(NotificationPreferencesController)).toEqual([
      { method: RequestMethod.GET, path: '/notification-preferences' },
      { method: RequestMethod.PUT, path: '/notification-preferences' },
      { method: RequestMethod.POST, path: '/notification-preferences/reset' },
    ]);
  });

  it('does not expose the removed /notifications/preferences routes', () => {
    const preferenceRoutes = routesOf(NotificationsController).filter((route) =>
      route.path.includes('preference'),
    );

    expect(preferenceRoutes).toEqual([]);
  });

  it('does not expose the removed /users/me/notification-preferences routes', () => {
    const preferenceRoutes = routesOf(UsersController).filter((route) =>
      route.path.includes('notification-preference'),
    );

    expect(preferenceRoutes).toEqual([]);
  });
});

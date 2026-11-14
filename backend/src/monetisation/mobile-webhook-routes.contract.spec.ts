import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AppleNotificationController } from './apple-notification.controller';
import { GooglePlayNotificationController } from './google-play-notification.controller';
import { MonetisationController } from './monetisation.controller';
import { MonetisationModule } from './monetisation.module';

interface RouteEntry {
  method: RequestMethod;
  path: string;
}

function moduleRoutes(): RouteEntry[] {
  const controllers =
    (Reflect.getMetadata('controllers', MonetisationModule) as object[]) ?? [];

  return controllers.flatMap((controller) => {
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
        return [
          { method, path: joined === '/' ? joined : joined.replace(/\/$/, '') },
        ];
      });
  });
}

describe('mobile subscription webhook route inventory', () => {
  const routes = moduleRoutes();
  const count = (path: string) =>
    routes.filter((route) => route.path === path).length;

  it('mounts each Apple and Google notification controller exactly once', () => {
    const controllers =
      (Reflect.getMetadata('controllers', MonetisationModule) as object[]) ??
      [];

    expect(
      controllers.filter(
        (controller) => controller === AppleNotificationController,
      ),
    ).toHaveLength(1);
    expect(
      controllers.filter(
        (controller) => controller === GooglePlayNotificationController,
      ),
    ).toHaveLength(1);
  });

  it('exposes exactly one Apple and one Google webhook route', () => {
    expect(count('/monetisation/webhooks/apple')).toBe(1);
    expect(count('/monetisation/webhooks/google')).toBe(1);
    expect(
      routes.filter(
        (route) =>
          route.path === '/monetisation/webhooks/apple' &&
          route.method === RequestMethod.POST,
      ),
    ).toHaveLength(1);
    expect(
      routes.filter(
        (route) =>
          route.path === '/monetisation/webhooks/google' &&
          route.method === RequestMethod.POST,
      ),
    ).toHaveLength(1);
  });

  it('keeps the duplicate handlers off MonetisationController', () => {
    const prototype = MonetisationController.prototype;
    const ownPaths = Object.getOwnPropertyNames(prototype)
      .filter((name) => name !== 'constructor')
      .map((name) =>
        String(Reflect.getMetadata(PATH_METADATA, prototype[name]) ?? ''),
      );

    expect(ownPaths).not.toContain('webhooks/apple');
    expect(ownPaths).not.toContain('webhooks/google');
  });
});

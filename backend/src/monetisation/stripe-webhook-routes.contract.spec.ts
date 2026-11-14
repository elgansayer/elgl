import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
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
          {
            method,
            path: joined === '/' ? joined : joined.replace(/\/$/, ''),
          },
        ];
      });
  });
}

describe('Stripe webhook route inventory', () => {
  it('mounts exactly one Stripe webhook route', () => {
    const stripeRoutes = moduleRoutes().filter((route) =>
      route.path.toLowerCase().includes('stripe'),
    );

    expect(stripeRoutes).toEqual([
      { method: RequestMethod.POST, path: '/monetisation/webhooks/stripe' },
    ]);
  });

  it('does not mount the legacy /stripe/webhook controller', () => {
    const paths = moduleRoutes().map((route) => route.path);

    expect(paths).not.toContain('/stripe/webhook');
  });
});

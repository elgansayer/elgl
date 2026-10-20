import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from './current-user.decorator';

type CurrentUserFactory = (
  data: unknown,
  context: ExecutionContext,
) => User | null;

class CurrentUserTestController {
  handle(@CurrentUser() _user: User | null): void {}
}

function getCurrentUserFactory(): CurrentUserFactory {
  const routeArgs = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    CurrentUserTestController,
    'handle',
  ) as Record<string, { factory?: CurrentUserFactory }> | undefined;
  const metadata = routeArgs ? Object.values(routeArgs)[0] : undefined;

  if (!metadata?.factory) {
    throw new Error(
      'CurrentUser decorator factory metadata was not registered',
    );
  }

  return metadata.factory;
}

function createContext(
  type: 'http' | 'ws' | 'rpc',
  requestOrClient: { user?: User },
): ExecutionContext {
  return {
    getType: vi.fn().mockReturnValue(type),
    switchToHttp: vi.fn().mockReturnValue({
      getRequest: vi.fn().mockReturnValue(requestOrClient),
    }),
    switchToWs: vi.fn().mockReturnValue({
      getClient: vi.fn().mockReturnValue(requestOrClient),
    }),
  } as unknown as ExecutionContext;
}

describe('CurrentUser', () => {
  const factory = getCurrentUserFactory();

  it('returns the authenticated user from an HTTP request', () => {
    const user = { id: 'http-user' } as User;
    const context = createContext('http', { user });

    expect(factory(undefined, context)).toBe(user);
  });

  it('returns null when an HTTP request has no authenticated user', () => {
    const context = createContext('http', {});

    expect(factory(undefined, context)).toBeNull();
  });

  it('returns the authenticated user from a WebSocket client', () => {
    const user = { id: 'ws-user' } as User;
    const context = createContext('ws', { user });

    expect(factory(undefined, context)).toBe(user);
  });

  it('returns null when a WebSocket client has no authenticated user', () => {
    const context = createContext('ws', {});

    expect(factory(undefined, context)).toBeNull();
  });

  it('returns null for unsupported execution contexts', () => {
    const context = createContext('rpc', {
      user: { id: 'stale-user' } as User,
    });

    expect(factory(undefined, context)).toBeNull();
  });
});

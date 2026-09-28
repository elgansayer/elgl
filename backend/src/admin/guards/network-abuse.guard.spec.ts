import {
  ExecutionContext,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { AdminNetworkAbuseService } from '../admin-network-abuse.service';
import { AdminRateLimitControlService } from '../admin-rate-limit-control.service';
import { NetworkAbuseGuard } from './network-abuse.guard';

function contextFor(input: {
  path: string;
  method?: string;
  ip?: string;
  headers?: Record<string, string>;
}): { context: ExecutionContext; setHeader: ReturnType<typeof vi.fn> } {
  const request = {
    path: input.path,
    method: input.method ?? 'GET',
    ip: input.ip ?? '8.8.8.8',
    socket: { remoteAddress: input.ip ?? '8.8.8.8' },
    headers: input.headers ?? {},
  };
  const setHeader = vi.fn();
  return {
    context: {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ setHeader }),
        getNext: vi.fn(),
      }),
    } as unknown as ExecutionContext,
    setHeader,
  };
}

describe('NetworkAbuseGuard', () => {
  let isRequestBlocked: ReturnType<typeof vi.fn>;
  let consume: ReturnType<typeof vi.fn>;
  let guard: NetworkAbuseGuard;

  beforeEach(() => {
    isRequestBlocked = vi.fn().mockResolvedValue(false);
    consume = vi.fn().mockResolvedValue({ limited: false, retryAfter: 0 });
    guard = new NetworkAbuseGuard(
      { isRequestBlocked } as unknown as AdminNetworkAbuseService,
      { consume } as unknown as AdminRateLimitControlService,
    );
  });

  afterEach(() => {
    delete process.env.TRUST_CLOUDFLARE_CONNECTING_IP;
  });

  it('keeps the admin recovery surface exempt behind the global API prefix', async () => {
    await expect(
      guard.canActivate(
        contextFor({ path: '/api/admin/v1/security/network/blocks' }).context,
      ),
    ).resolves.toBe(true);
    expect(isRequestBlocked).not.toHaveBeenCalled();
    expect(consume).not.toHaveBeenCalled();
  });

  it('maps auth and write requests to their intended scopes', async () => {
    await guard.canActivate(
      contextFor({ path: '/api/auth/login', method: 'POST', ip: '1.1.1.1' })
        .context,
    );
    await guard.canActivate(
      contextFor({
        path: '/api/chat/messages',
        method: 'POST',
        ip: '1.1.1.1',
      }).context,
    );
    await guard.canActivate(
      contextFor({ path: '/api/discovery', method: 'GET', ip: '1.1.1.1' })
        .context,
    );

    expect(isRequestBlocked).toHaveBeenNthCalledWith(1, '1.1.1.1', 'auth');
    expect(isRequestBlocked).toHaveBeenNthCalledWith(2, '1.1.1.1', 'write');
    expect(isRequestBlocked).toHaveBeenNthCalledWith(3, '1.1.1.1', 'all');
    expect(consume).toHaveBeenNthCalledWith(1, '1.1.1.1', 'auth');
    expect(consume).toHaveBeenNthCalledWith(2, '1.1.1.1', 'write');
    expect(consume).toHaveBeenNthCalledWith(3, '1.1.1.1', 'all');
  });

  it('preserves hard blocks ahead of additive rate limits', async () => {
    isRequestBlocked.mockResolvedValue(true);

    await expect(
      guard.canActivate(
        contextFor({ path: '/api/moments', method: 'POST' }).context,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(consume).not.toHaveBeenCalled();
  });

  it('returns 429 with Retry-After when an emergency throttle is exceeded', async () => {
    consume.mockResolvedValue({
      limited: true,
      retryAfter: 23,
      controlId: 'e056c664-a1a8-4e87-aa54-75bca9ea1d14',
    });
    const { context, setHeader } = contextFor({
      path: '/api/auth/login',
      method: 'POST',
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 429,
    });
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '23');
  });

  it('does not expose the internal control identifier in the 429 response', async () => {
    consume.mockResolvedValue({
      limited: true,
      retryAfter: 10,
      controlId: 'internal-control-id',
    });

    try {
      await guard.canActivate(
        contextFor({ path: '/api/moments', method: 'POST' }).context,
      );
      throw new Error('Expected rate-limit failure');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect(
        JSON.stringify((error as HttpException).getResponse()),
      ).not.toContain('internal-control-id');
    }
  });

  it('trusts Cloudflare client IP only when explicitly enabled', async () => {
    process.env.TRUST_CLOUDFLARE_CONNECTING_IP = 'true';

    await guard.canActivate(
      contextFor({
        path: '/api/discovery',
        ip: '203.0.113.10',
        headers: { 'cf-connecting-ip': '8.8.4.4' },
      }).context,
    );

    expect(isRequestBlocked).toHaveBeenCalledWith('8.8.4.4', 'all');
    expect(consume).toHaveBeenCalledWith('8.8.4.4', 'all');
  });
});

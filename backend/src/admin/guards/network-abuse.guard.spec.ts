import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminNetworkAbuseService } from '../admin-network-abuse.service';
import { NetworkAbuseGuard } from './network-abuse.guard';

function contextFor(input: {
  path: string;
  method?: string;
  ip?: string;
  headers?: Record<string, string>;
}): ExecutionContext {
  const request = {
    path: input.path,
    method: input.method ?? 'GET',
    ip: input.ip ?? '8.8.8.8',
    socket: { remoteAddress: input.ip ?? '8.8.8.8' },
    headers: input.headers ?? {},
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('NetworkAbuseGuard', () => {
  afterEach(() => {
    delete process.env.TRUST_CLOUDFLARE_CONNECTING_IP;
  });

  it('keeps the admin recovery surface exempt behind the global API prefix', async () => {
    const isRequestBlocked = vi.fn();
    const guard = new NetworkAbuseGuard({
      isRequestBlocked,
    } as unknown as AdminNetworkAbuseService);

    await expect(
      guard.canActivate(
        contextFor({ path: '/api/admin/v1/security/network/blocks' }),
      ),
    ).resolves.toBe(true);
    expect(isRequestBlocked).not.toHaveBeenCalled();
  });

  it('maps auth and write requests to their intended scopes', async () => {
    const isRequestBlocked = vi.fn().mockResolvedValue(false);
    const guard = new NetworkAbuseGuard({
      isRequestBlocked,
    } as unknown as AdminNetworkAbuseService);

    await guard.canActivate(
      contextFor({ path: '/api/auth/login', method: 'POST', ip: '1.1.1.1' }),
    );
    await guard.canActivate(
      contextFor({ path: '/api/chat/messages', method: 'POST', ip: '1.1.1.1' }),
    );
    await guard.canActivate(
      contextFor({ path: '/api/discovery', method: 'GET', ip: '1.1.1.1' }),
    );

    expect(isRequestBlocked).toHaveBeenNthCalledWith(1, '1.1.1.1', 'auth');
    expect(isRequestBlocked).toHaveBeenNthCalledWith(2, '1.1.1.1', 'write');
    expect(isRequestBlocked).toHaveBeenNthCalledWith(3, '1.1.1.1', 'all');
  });

  it('rejects a request when a matching control is active', async () => {
    const guard = new NetworkAbuseGuard({
      isRequestBlocked: vi.fn().mockResolvedValue(true),
    } as unknown as AdminNetworkAbuseService);

    await expect(
      guard.canActivate(contextFor({ path: '/api/moments', method: 'POST' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('trusts Cloudflare client IP only when explicitly enabled', async () => {
    process.env.TRUST_CLOUDFLARE_CONNECTING_IP = 'true';
    const isRequestBlocked = vi.fn().mockResolvedValue(false);
    const guard = new NetworkAbuseGuard({
      isRequestBlocked,
    } as unknown as AdminNetworkAbuseService);

    await guard.canActivate(
      contextFor({
        path: '/api/discovery',
        ip: '203.0.113.10',
        headers: { 'cf-connecting-ip': '8.8.4.4' },
      }),
    );

    expect(isRequestBlocked).toHaveBeenCalledWith('8.8.4.4', 'all');
  });
});

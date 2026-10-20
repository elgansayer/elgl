import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminNetworkAbuseService } from '../admin-network-abuse.service';
import { AdminNetworkProviderService } from '../admin-network-provider.service';
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

function createGuard(options?: {
  ipBlocked?: boolean;
  providerBlocked?: boolean;
}) {
  const network = {
    isRequestBlocked: vi.fn().mockResolvedValue(options?.ipBlocked ?? false),
  };
  const provider = {
    isRequestBlocked: vi
      .fn()
      .mockResolvedValue(options?.providerBlocked ?? false),
    recordSignal: vi.fn().mockResolvedValue(undefined),
    normalizeAsn: vi.fn((value: number) => {
      if (!Number.isInteger(value) || value < 1 || value > 4_294_967_295) {
        throw new Error('invalid ASN');
      }
      return value;
    }),
    normalizeProvider: vi.fn((value: string | undefined) => value?.trim() || null),
  };
  return {
    guard: new NetworkAbuseGuard(
      network as unknown as AdminNetworkAbuseService,
      provider as unknown as AdminNetworkProviderService,
    ),
    network,
    provider,
  };
}

describe('NetworkAbuseGuard', () => {
  afterEach(() => {
    delete process.env.TRUST_CLOUDFLARE_CONNECTING_IP;
    delete process.env.TRUST_CLOUDFLARE_NETWORK_METADATA;
  });

  it('keeps the admin recovery surface exempt behind the global API prefix', async () => {
    const { guard, network, provider } = createGuard();

    await expect(
      guard.canActivate(
        contextFor({ path: '/api/admin/v1/security/network/blocks' }),
      ),
    ).resolves.toBe(true);
    expect(network.isRequestBlocked).not.toHaveBeenCalled();
    expect(provider.isRequestBlocked).not.toHaveBeenCalled();
  });

  it('maps auth and write requests to their intended scopes', async () => {
    const { guard, network, provider } = createGuard();

    await guard.canActivate(
      contextFor({ path: '/api/auth/login', method: 'POST', ip: '1.1.1.1' }),
    );
    await guard.canActivate(
      contextFor({ path: '/api/chat/messages', method: 'POST', ip: '1.1.1.1' }),
    );
    await guard.canActivate(
      contextFor({ path: '/api/discovery', method: 'GET', ip: '1.1.1.1' }),
    );

    expect(network.isRequestBlocked).toHaveBeenNthCalledWith(
      1,
      '1.1.1.1',
      'auth',
    );
    expect(network.isRequestBlocked).toHaveBeenNthCalledWith(
      2,
      '1.1.1.1',
      'write',
    );
    expect(network.isRequestBlocked).toHaveBeenNthCalledWith(
      3,
      '1.1.1.1',
      'all',
    );
    expect(provider.isRequestBlocked).toHaveBeenNthCalledWith(1, undefined, 'auth');
    expect(provider.isRequestBlocked).toHaveBeenNthCalledWith(2, undefined, 'write');
    expect(provider.isRequestBlocked).toHaveBeenNthCalledWith(3, undefined, 'all');
  });

  it('rejects a request when either an IP or ASN control is active', async () => {
    const ip = createGuard({ ipBlocked: true });
    await expect(
      ip.guard.canActivate(contextFor({ path: '/api/moments', method: 'POST' })),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const asn = createGuard({ providerBlocked: true });
    process.env.TRUST_CLOUDFLARE_CONNECTING_IP = 'true';
    process.env.TRUST_CLOUDFLARE_NETWORK_METADATA = 'true';
    await expect(
      asn.guard.canActivate(
        contextFor({
          path: '/api/moments',
          method: 'POST',
          headers: { 'x-elgl-client-asn': '13335' },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('trusts Cloudflare client IP only when explicitly enabled', async () => {
    process.env.TRUST_CLOUDFLARE_CONNECTING_IP = 'true';
    const { guard, network } = createGuard();

    await guard.canActivate(
      contextFor({
        path: '/api/discovery',
        ip: '203.0.113.10',
        headers: { 'cf-connecting-ip': '8.8.4.4' },
      }),
    );

    expect(network.isRequestBlocked).toHaveBeenCalledWith('8.8.4.4', 'all');
  });

  it('ignores forgeable ASN metadata unless both Cloudflare trust switches are enabled', async () => {
    const { guard, provider } = createGuard();

    await guard.canActivate(
      contextFor({
        path: '/api/chat/messages',
        method: 'POST',
        headers: {
          'x-elgl-client-asn': '13335',
          'x-elgl-client-provider': 'Cloudflare',
          'x-elgl-client-hosting': 'true',
        },
      }),
    );

    expect(provider.isRequestBlocked).toHaveBeenCalledWith(undefined, 'write');
    expect(provider.recordSignal).not.toHaveBeenCalled();
  });

  it('uses trusted ASN metadata for scoped enforcement and privacy-minimized trends', async () => {
    process.env.TRUST_CLOUDFLARE_CONNECTING_IP = 'true';
    process.env.TRUST_CLOUDFLARE_NETWORK_METADATA = 'true';
    const { guard, provider } = createGuard();

    await guard.canActivate(
      contextFor({
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'x-elgl-client-asn': '13335',
          'x-elgl-client-provider': ' Cloudflare ',
          'x-elgl-client-hosting': 'true',
        },
      }),
    );

    expect(provider.recordSignal).toHaveBeenCalledWith(
      { asn: 13335, provider: 'Cloudflare', isHostingProvider: true },
      'auth',
    );
    expect(provider.isRequestBlocked).toHaveBeenCalledWith(13335, 'auth');
  });

  it('drops invalid trusted ASN metadata instead of making an enforcement decision from it', async () => {
    process.env.TRUST_CLOUDFLARE_CONNECTING_IP = 'true';
    process.env.TRUST_CLOUDFLARE_NETWORK_METADATA = 'true';
    const { guard, provider } = createGuard();

    await guard.canActivate(
      contextFor({
        path: '/api/chat/messages',
        method: 'POST',
        headers: { 'x-elgl-client-asn': '99999999999' },
      }),
    );

    expect(provider.recordSignal).not.toHaveBeenCalled();
    expect(provider.isRequestBlocked).toHaveBeenCalledWith(undefined, 'write');
  });
});

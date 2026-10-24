import { BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AdminNetworkProviderService } from './admin-network-provider.service';

function createService(options?: {
  cached?: string | null;
  rpcData?: unknown;
  rpcError?: unknown;
}) {
  const rpc = vi.fn().mockResolvedValue({
    data: options?.rpcData ?? false,
    error: options?.rpcError ?? null,
  });
  const redis = {
    get: vi.fn().mockImplementation((key: string) =>
      Promise.resolve(
        key === 'network-abuse:v1:epoch' ? '4' : (options?.cached ?? null),
      ),
    ),
    set: vi.fn().mockResolvedValue('OK'),
    incr: vi.fn().mockResolvedValue(5),
  };
  const service = new AdminNetworkProviderService({
    getClient: vi.fn().mockReturnValue({ rpc }),
    getRedisClient: vi.fn().mockReturnValue(redis),
  } as unknown as SupabaseService);
  return { service, rpc, redis };
}

describe('AdminNetworkProviderService', () => {
  it('accepts only public 32-bit ASN values', () => {
    const { service } = createService();

    expect(service.normalizeAsn(1)).toBe(1);
    expect(service.normalizeAsn(4_294_967_295)).toBe(4_294_967_295);
    expect(() => service.normalizeAsn(0)).toThrow(BadRequestException);
    expect(() => service.normalizeAsn(1.5)).toThrow(BadRequestException);
    expect(() => service.normalizeAsn(4_294_967_296)).toThrow(
      BadRequestException,
    );
  });

  it('bounds and sanitizes trusted provider labels', () => {
    const { service } = createService();

    expect(service.normalizeProvider('  Example\u0000 Hosting  ')).toBe(
      'Example  Hosting',
    );
    expect(service.normalizeProvider('x'.repeat(200))).toHaveLength(120);
    expect(service.normalizeProvider('   ')).toBeNull();
  });

  it('uses a bounded provider decision cache without persisting provider labels', async () => {
    const { service, redis, rpc } = createService({ rpcData: true });

    await expect(service.isRequestBlocked(13335, 'write')).resolves.toBe(true);

    expect(rpc).toHaveBeenCalledWith('is_network_provider_request_blocked', {
      p_asn: 13335,
      p_scope: 'write',
    });
    const [cacheKey] = redis.get.mock.calls[1] as [string];
    expect(cacheKey).toBe('network-abuse:provider:4:13335:write');
    expect(redis.set).toHaveBeenCalledWith(cacheKey, '1', 'EX', 30);
  });

  it('uses cached provider decisions without querying PostgreSQL', async () => {
    const { service, rpc } = createService({ cached: '0', rpcData: true });

    await expect(service.isRequestBlocked(13335, 'auth')).resolves.toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('fails open when provider enforcement storage is unavailable', async () => {
    const { service } = createService({ rpcError: new Error('db unavailable') });

    await expect(service.isRequestBlocked(13335, 'auth')).resolves.toBe(false);
  });

  it('records only privacy-minimized auth/write aggregate signals', async () => {
    const { service, rpc } = createService();

    await service.recordSignal(
      { asn: 13335, provider: 'Cloudflare', isHostingProvider: true },
      'write',
    );
    await service.recordSignal(
      { asn: 13335, provider: 'Cloudflare', isHostingProvider: true },
      'all',
    );

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('record_network_provider_signal', {
      p_asn: 13335,
      p_provider: 'Cloudflare',
      p_is_hosting: true,
      p_scope: 'write',
    });
  });

  it('does not let aggregate write failures become request failures', async () => {
    const { service } = createService({ rpcError: new Error('write failed') });

    await expect(
      service.recordSignal(
        { asn: 13335, provider: 'Cloudflare', isHostingProvider: false },
        'auth',
      ),
    ).resolves.toBeUndefined();
  });

  it('maps bounded provider reputation data', async () => {
    const { service } = createService({
      rpcData: {
        asn: 13335,
        provider: 'Cloudflare',
        is_hosting_provider: true,
        risk_level: 'high',
        signals: ['hosting_provider', 'elevated_weekly_activity'],
        requests_today: 25,
        requests_7d: 250,
        active_days_7d: 7,
        latest_seen_at: '2026-08-24T15:00:00.000Z',
        allowlisted: false,
        active_blocks: [
          {
            id: 'block-id',
            scope: 'auth',
            expires_at: '2026-08-25T15:00:00.000Z',
          },
        ],
      },
    });

    await expect(service.lookup(13335)).resolves.toEqual({
      asn: 13335,
      provider: 'Cloudflare',
      isHostingProvider: true,
      riskLevel: 'high',
      signals: ['hosting_provider', 'elevated_weekly_activity'],
      requestsToday: 25,
      requests7d: 250,
      activeDays7d: 7,
      latestSeenAt: '2026-08-24T15:00:00.000Z',
      allowlisted: false,
      activeBlocks: [
        {
          id: 'block-id',
          scope: 'auth',
          expiresAt: '2026-08-25T15:00:00.000Z',
        },
      ],
    });
  });
});

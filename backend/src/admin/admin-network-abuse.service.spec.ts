import { BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AdminNetworkAbuseService } from './admin-network-abuse.service';

function createService(options?: {
  rpcData?: unknown;
  rpcError?: unknown;
  cached?: string | null;
}) {
  const rpc = vi.fn().mockResolvedValue({
    data: options?.rpcData ?? false,
    error: options?.rpcError ?? null,
  });
  const redis = {
    get: vi
      .fn()
      .mockImplementation((key: string) =>
        Promise.resolve(
          key === 'network-abuse:v1:epoch' ? '0' : (options?.cached ?? null),
        ),
      ),
    set: vi.fn().mockResolvedValue('OK'),
    incr: vi.fn().mockResolvedValue(1),
  };
  const service = new AdminNetworkAbuseService({
    getClient: vi.fn().mockReturnValue({ rpc }),
    getRedisClient: vi.fn().mockReturnValue(redis),
  } as unknown as SupabaseService);
  return { service, rpc, redis };
}

describe('AdminNetworkAbuseService', () => {
  it('allows only bounded public CIDRs', () => {
    const { service } = createService();

    expect(service.normalizeCidr('8.8.8.8')).toBe('8.8.8.8/32');
    expect(service.normalizeCidr('8.8.8.0/24')).toBe('8.8.8.0/24');
    expect(service.normalizeCidr('2606:4700:4700::/64')).toBe(
      '2606:4700:4700::/64',
    );
    expect(() => service.normalizeCidr('8.8.0.0/16')).toThrow(
      BadRequestException,
    );
    expect(() => service.normalizeCidr('10.0.0.1')).toThrow(
      BadRequestException,
    );
    expect(() => service.normalizeCidr('127.0.0.1')).toThrow(
      BadRequestException,
    );
    expect(() => service.normalizeCidr('fc00::1')).toThrow(BadRequestException);
  });

  it('does not persist raw IPs in Redis decision keys', async () => {
    const { service, redis } = createService({ rpcData: true });

    await expect(service.isRequestBlocked('8.8.8.8', 'write')).resolves.toBe(
      true,
    );

    expect(redis.get).toHaveBeenCalledTimes(2);
    const [cacheKey] = redis.get.mock.calls[1] as [string];
    expect(cacheKey).not.toContain('8.8.8.8');
    expect(cacheKey).toMatch(/^network-abuse:v1:0:[a-f0-9]{24}:write$/);
    expect(redis.set).toHaveBeenCalledWith(cacheKey, '1', 'EX', 30);
  });

  it('uses cached decisions without querying PostgreSQL', async () => {
    const { service, rpc } = createService({ cached: '0', rpcData: true });

    await expect(service.isRequestBlocked('8.8.4.4', 'all')).resolves.toBe(
      false,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('fails open when the enforcement store is unavailable', async () => {
    const { service } = createService({
      rpcError: new Error('db unavailable'),
    });

    await expect(service.isRequestBlocked('1.1.1.1', 'auth')).resolves.toBe(
      false,
    );
  });

  it('rejects private or malformed lookup addresses before storage access', async () => {
    const { service, rpc } = createService();

    await expect(service.lookup('192.168.1.10')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.lookup('not-an-ip')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(rpc).not.toHaveBeenCalled();
  });
});

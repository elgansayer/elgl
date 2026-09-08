import { AdminNetworkAbuseService } from './admin-network-abuse.service';
import { AdminRateLimitControlService } from './admin-rate-limit-control.service';
import { SupabaseService } from '../supabase/supabase.service';

const control = {
  id: 'e056c664-a1a8-4e87-aa54-75bca9ea1d14',
  network: '8.8.8.0/24',
  scope: 'all' as const,
  maxRequests: 2,
  windowSeconds: 60,
  reasonCode: 'abuse',
  expiresAt: '2099-01-01T00:00:00.000Z',
  createdAt: '2026-08-25T00:00:00.000Z',
  revokedAt: null,
};

describe('AdminRateLimitControlService', () => {
  let redis: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    incr: ReturnType<typeof vi.fn>;
    expire: ReturnType<typeof vi.fn>;
    ttl: ReturnType<typeof vi.fn>;
  };
  let supabase: {
    getRedisClient: ReturnType<typeof vi.fn>;
    getClient: ReturnType<typeof vi.fn>;
  };
  let networkAbuse: {
    normalizePublicIp: ReturnType<typeof vi.fn>;
    normalizeCidr: ReturnType<typeof vi.fn>;
  };
  let service: AdminRateLimitControlService;

  beforeEach(() => {
    redis = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'network-throttle:v1:epoch') return Promise.resolve('0');
        if (key.startsWith('network-throttle:v1:policy:')) {
          return Promise.resolve(JSON.stringify(control));
        }
        return Promise.resolve(null);
      }),
      set: vi.fn().mockResolvedValue('OK'),
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      ttl: vi.fn().mockResolvedValue(30),
    };
    supabase = {
      getRedisClient: vi.fn().mockReturnValue(redis),
      getClient: vi.fn(),
    };
    networkAbuse = {
      normalizePublicIp: vi.fn().mockImplementation((value: string) => value),
      normalizeCidr: vi.fn().mockImplementation((value: string) => value),
    };
    service = new AdminRateLimitControlService(
      supabase as unknown as SupabaseService,
      networkAbuse as unknown as AdminNetworkAbuseService,
    );
  });

  it('allows traffic within an active emergency throttle', async () => {
    redis.incr.mockResolvedValue(2);

    await expect(service.consume('8.8.8.8', 'all')).resolves.toEqual({
      limited: false,
      retryAfter: 0,
      controlId: control.id,
    });
    expect(redis.expire).not.toHaveBeenCalled();
  });

  it('rejects traffic above the active limit with the bucket TTL', async () => {
    redis.incr.mockResolvedValue(3);
    redis.ttl.mockResolvedValue(17);

    await expect(service.consume('8.8.8.8', 'all')).resolves.toEqual({
      limited: true,
      retryAfter: 17,
      controlId: control.id,
    });
  });

  it('sets a bounded expiry on the first fixed-window counter', async () => {
    redis.incr.mockResolvedValue(1);

    await service.consume('8.8.8.8', 'all');

    expect(redis.expire).toHaveBeenCalledWith(
      expect.stringContaining(`network-throttle:v1:count:${control.id}:`),
      62,
    );
  });

  it('fails open only for the additive throttle when Redis is degraded', async () => {
    redis.incr.mockRejectedValue(new Error('redis unavailable'));

    await expect(service.consume('8.8.8.8', 'write')).resolves.toEqual({
      limited: false,
      retryAfter: 0,
      controlId: control.id,
    });
  });

  it('does not persist or return a raw IPv4 address during inspection', async () => {
    redis.get.mockImplementation((key: string) => {
      if (key === 'network-throttle:v1:epoch') return Promise.resolve('0');
      if (key.startsWith('network-throttle:v1:policy:')) {
        return Promise.resolve(JSON.stringify(control));
      }
      if (key.startsWith('network-throttle:v1:count:')) {
        return Promise.resolve('1');
      }
      return Promise.resolve(null);
    });

    const result = await service.inspect('8.8.8.8', 'all');

    expect(result.network).toBe('8.8.8.0/24');
    expect(result.currentCount).toBe(1);
    expect(result.remaining).toBe(1);
    expect(JSON.stringify(result)).not.toContain('8.8.8.8');
  });

  it('ignores malformed client addresses without consulting policy storage', async () => {
    networkAbuse.normalizePublicIp.mockImplementation(() => {
      throw new Error('invalid public IP');
    });

    await expect(service.consume('127.0.0.1', 'all')).resolves.toEqual({
      limited: false,
      retryAfter: 0,
    });
    expect(redis.get).not.toHaveBeenCalled();
  });
});

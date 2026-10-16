import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { SafetyCacheInvalidationService } from './safety-cache-invalidation.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CloudflareCacheService } from '../cloudflare/cache.service';

describe('SafetyCacheInvalidationService', () => {
  let service: SafetyCacheInvalidationService;
  let mockRedis: Record<string, Mock>;
  let mockSupabaseService: { getRedisClient: Mock };
  let mockCloudflareCacheService: { purgeByCacheTags: Mock };

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

    mockRedis = {
      del: vi.fn(),
      keys: vi.fn(),
      scan: vi.fn(),
    };

    // Default: del resolves to number of keys deleted
    mockRedis.del.mockResolvedValue(0);
    mockRedis.keys.mockResolvedValue([]);
    mockRedis.scan.mockResolvedValue(['0', []]);

    mockSupabaseService = {
      getRedisClient: vi.fn().mockReturnValue(mockRedis),
    };

    mockCloudflareCacheService = {
      purgeByCacheTags: vi.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SafetyCacheInvalidationService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
        {
          provide: CloudflareCacheService,
          useValue: mockCloudflareCacheService,
        },
      ],
    }).compile();

    service = module.get<SafetyCacheInvalidationService>(
      SafetyCacheInvalidationService,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('invalidateTrustAndSafetyCaches', () => {
    it('should delete exact key partner_of_week_ids', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.invalidateTrustAndSafetyCaches();

      expect(mockRedis.del).toHaveBeenCalledWith('partner_of_week_ids');
    });

    it('should scan-and-delete suffixed glob patterns', async () => {
      mockRedis.del
        .mockResolvedValueOnce(0) // partner_of_week_ids
        .mockResolvedValueOnce(0) // scan result for admin:users:list:*
        .mockResolvedValueOnce(0) // scan result for admin:blocks:list:*
        .mockResolvedValueOnce(0) // keys result for admin:login-history:*
        .mockResolvedValueOnce(0) // keys result for daily_recommendations:*
        .mockResolvedValueOnce(0); // keys result for recommendations:daily:*
      mockRedis.scan.mockResolvedValue(['0', []]);

      await service.invalidateTrustAndSafetyCaches();

      // The pattern `admin:users:list:*` is stripped of the suffix `:*`
      // and scanned as `admin:users:list*`
      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'admin:users:list*',
        'COUNT',
        500,
      );
      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'admin:blocks:list*',
        'COUNT',
        500,
      );
    });

    it('should handle delete for prefix patterns', async () => {
      mockRedis.keys.mockResolvedValue([
        'admin:login-history:user-1',
        'admin:login-history:user-2',
      ]);
      mockRedis.del
        .mockResolvedValueOnce(0) // partner_of_week_ids
        .mockResolvedValueOnce(0) // scan for admin:users:list:
        .mockResolvedValueOnce(0) // scan for admin:blocks:list:
        .mockResolvedValueOnce(2); // del for login-history keys

      await service.invalidateTrustAndSafetyCaches();

      expect(mockRedis.keys).toHaveBeenCalledWith('admin:login-history:*');
      expect(mockRedis.del).toHaveBeenCalledWith(
        'admin:login-history:user-1',
        'admin:login-history:user-2',
      );
    });

    it('should purge Cloudflare edge caches after Redis keys are deleted', async () => {
      // Simulate a successful deletion (some keys found)
      mockRedis.del.mockResolvedValue(1);
      mockCloudflareCacheService.purgeByCacheTags.mockClear();

      await service.invalidateTrustAndSafetyCaches();

      // Best-effort purge of discovery:public and discovery:private tags
      expect(mockCloudflareCacheService.purgeByCacheTags).toHaveBeenCalledWith([
        'discovery:public',
        'discovery:private',
      ]);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis connection lost'));

      await expect(
        service.invalidateTrustAndSafetyCaches(),
      ).resolves.toBeUndefined();
    });

    it('should handle scan with multiple iterations', async () => {
      // admin:users:list:* scan: two iterations (cursor '1' then '0')
      // admin:blocks:list:* scan: one iteration (default mock returns ['0', []])
      mockRedis.scan
        .mockResolvedValueOnce(['1', ['admin:users:list:1:20:']])
        .mockResolvedValueOnce(['0', ['admin:users:list:2:20:']]);
      mockRedis.del
        .mockResolvedValueOnce(0) // partner_of_week_ids
        .mockResolvedValueOnce(1) // admin:users:list scan batch 1
        .mockResolvedValueOnce(1) // admin:users:list scan batch 2
        .mockResolvedValueOnce(0) // admin:blocks:list scan
        .mockResolvedValueOnce(0) // login-history keys
        .mockResolvedValueOnce(0) // daily_recommendations keys
        .mockResolvedValueOnce(0); // recommendations:daily keys

      await service.invalidateTrustAndSafetyCaches();

      // 2 iterations for admin:users:list:* + 1 iteration for admin:blocks:list:*
      expect(mockRedis.scan).toHaveBeenCalledTimes(3);
    });
  });

  describe('invalidateUserPairCaches', () => {
    it('should delete recommendation and login-history keys for both users', async () => {
      mockRedis.del.mockResolvedValue(4);

      await service.invalidateUserPairCaches('user-a', 'user-b');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'admin:login-history:user-a',
        'admin:login-history:user-b',
        'daily_recommendations:user-a',
        'daily_recommendations:user-b',
        'recommendations:daily:user-a',
        'recommendations:daily:user-b',
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.invalidateUserPairCaches('user-a', 'user-b'),
      ).resolves.toBeUndefined();
    });
  });

  describe('invalidateUserCaches', () => {
    it('should delete recommendation and login-history keys for the user', async () => {
      mockRedis.del.mockResolvedValue(3);

      await service.invalidateUserCaches('user-a');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'admin:login-history:user-a',
        'daily_recommendations:user-a',
        'recommendations:daily:user-a',
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.invalidateUserPairCaches('user-a', 'user-b'),
      ).resolves.toBeUndefined();
    });
  });

  describe('SCAN-based deletion (deleteByScan)', () => {
    it('should iterate until cursor returns 0 and accumulate deleted count', async () => {
      // admin:users:list:* scan: 2 iterations
      mockRedis.scan
        .mockResolvedValueOnce(['5', ['key1', 'key2']])
        .mockResolvedValueOnce(['0', ['key3']]);
      // admin:blocks:list:* scan: 1 iteration (default mock)
      mockRedis.del
        .mockResolvedValueOnce(0) // partner_of_week_ids
        .mockResolvedValueOnce(2) // batch 1 for admin:users:list scan
        .mockResolvedValueOnce(1) // batch 2 for admin:users:list scan
        .mockResolvedValueOnce(0) // admin:blocks:list scan
        .mockResolvedValueOnce(0) // login-history keys
        .mockResolvedValueOnce(0) // daily_recommendations keys
        .mockResolvedValueOnce(0); // recommendations:daily keys

      await service.invalidateTrustAndSafetyCaches();

      expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2');
      expect(mockRedis.del).toHaveBeenCalledWith('key3');
    });
  });
});

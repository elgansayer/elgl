import type { Mock } from 'vitest';
/// <reference types="vi" />
import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryCacheInvalidationService } from './discovery-cache-invalidation.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  DiscoveryCacheNamespace,
  DiscoveryCacheInvalidationTrigger,
} from './interfaces/cache-rules.interface';

describe('DiscoveryCacheInvalidationService', () => {
  let service: DiscoveryCacheInvalidationService;
  let mockRedis: {
    del: Mock;
    scan: Mock;
    get: Mock;
    set: Mock;
  };

  beforeEach(async () => {
    mockRedis = {
      del: vi.fn().mockResolvedValue(1),
      scan: vi.fn().mockResolvedValue(['0', []]),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscoveryCacheInvalidationService,
        {
          provide: `PinoLogger:${DiscoveryCacheInvalidationService.name}`,
          useValue: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
          },
        },
        {
          provide: SupabaseService,
          useValue: { getRedisClient: () => mockRedis },
        },
      ],
    }).compile();

    service = module.get<DiscoveryCacheInvalidationService>(
      DiscoveryCacheInvalidationService,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // rules
  // -------------------------------------------------------------------------
  describe('rules', () => {
    it('should contain rules for every trigger defined in the enum', () => {
      const coveredTriggers = new Set<DiscoveryCacheInvalidationTrigger>();
      for (const rule of service.rules) {
        for (const trigger of rule.triggers) {
          coveredTriggers.add(trigger);
        }
      }

      for (const trigger of Object.values(DiscoveryCacheInvalidationTrigger)) {
        expect(coveredTriggers.has(trigger)).toBe(true);
      }
    });

    it('should have a non-empty pattern list for every rule', () => {
      for (const rule of service.rules) {
        expect(rule.patterns.length).toBeGreaterThan(0);
        expect(rule.description.length).toBeGreaterThan(0);
      }
    });

    it('should include partner_of_week in its rules', () => {
      const potwRule = service.rules.find((r) =>
        r.patterns.includes(DiscoveryCacheNamespace.PARTNER_OF_WEEK),
      );
      expect(potwRule).toBeDefined();
      expect(potwRule!.triggers).toContain(
        DiscoveryCacheInvalidationTrigger.PARTNER_OF_WEEK_UPDATED,
      );
    });

    it('should include user_profile_updated rule covering user-scoped keys', () => {
      const profileRule = service.rules.find((r) =>
        r.triggers.includes(
          DiscoveryCacheInvalidationTrigger.USER_PROFILE_UPDATED,
        ),
      );
      expect(profileRule).toBeDefined();
      expect(
        profileRule!.patterns.some((p) => p.includes('partner_search')),
      ).toBe(true);
      expect(
        profileRule!.patterns.some((p) => p.includes('language_pair')),
      ).toBe(true);
      expect(
        profileRule!.patterns.some((p) => p.includes('location_search')),
      ).toBe(true);
      expect(
        profileRule!.patterns.some((p) => p.includes('audio_intros')),
      ).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Event-driven invalidation handlers
  // -------------------------------------------------------------------------
  describe('handlePartnerOfWeekUpdated', () => {
    it('should delete partner_of_week_ids key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.handlePartnerOfWeekUpdated();

      expect(mockRedis.del).toHaveBeenCalledWith('partner_of_week_ids');
    });

    it('should log when key is deleted', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.handlePartnerOfWeekUpdated();

      // del should be called, and no error thrown
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should not throw when key does not exist (del returns 0)', async () => {
      mockRedis.del.mockResolvedValue(0);

      await expect(service.handlePartnerOfWeekUpdated()).resolves.not.toThrow();
    });
  });

  describe('handleDailyRecommendationsUpdated', () => {
    it('should scan-delete recommendation patterns', async () => {
      mockRedis.scan
        .mockResolvedValueOnce([
          '0',
          ['daily_recommendations:a', 'daily_recommendations:b'],
        ])
        .mockResolvedValueOnce(['0', ['recommendations:daily:x']]);
      mockRedis.del.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

      await service.handleDailyRecommendationsUpdated();

      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'daily_recommendations:*',
        'COUNT',
        100,
      );
      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'recommendations:daily:*',
        'COUNT',
        100,
      );
    });
  });

  describe('handleUserProfileUpdated', () => {
    it('should invalidate user-scoped discovery caches', async () => {
      mockRedis.scan
        .mockResolvedValueOnce([
          '0',
          ['discovery:partner_search:user:u1:hash1'],
        ])
        .mockResolvedValueOnce(['0', []])
        .mockResolvedValueOnce(['0', []])
        .mockResolvedValueOnce(['0', []]);
      mockRedis.del.mockResolvedValue(1);

      await service.handleUserProfileUpdated({ userId: 'u1' });

      // Four patterns attempted
      expect(mockRedis.scan).toHaveBeenCalledTimes(4);
      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'discovery:partner_search:user:u1:*',
        'COUNT',
        100,
      );
      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'discovery:language_pair:user:u1:*',
        'COUNT',
        100,
      );
      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'discovery:location_search:user:u1:*',
        'COUNT',
        100,
      );
      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'discovery:audio_intros:user:u1:*',
        'COUNT',
        100,
      );
    });
  });

  describe('handleUserVipUpdated', () => {
    it('should delete shared discovery caches on VIP change', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.handleUserVipUpdated();

      expect(mockRedis.del).toHaveBeenCalledWith('partner_of_week_ids');
      expect(mockRedis.del).toHaveBeenCalledWith('discovery:recent_native');
      expect(mockRedis.del).toHaveBeenCalledWith('discovery:spotlight');
    });
  });

  describe('handleUserLocationUpdated', () => {
    it('should invalidate location and partner search caches for user', async () => {
      mockRedis.scan
        .mockResolvedValueOnce([
          '0',
          ['discovery:location_search:user:u2:hash'],
        ])
        .mockResolvedValueOnce(['0', []]);
      mockRedis.del.mockResolvedValue(1);

      await service.handleUserLocationUpdated({ userId: 'u2' });

      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'discovery:location_search:user:u2:*',
        'COUNT',
        100,
      );
      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'discovery:partner_search:user:u2:*',
        'COUNT',
        100,
      );
    });
  });

  describe('handleUserMetricsUpdated', () => {
    it('should invalidate recommendations and shared lists', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['0', ['daily_recommendations:u1']])
        .mockResolvedValueOnce(['0', []]);
      mockRedis.del
        .mockResolvedValueOnce(1) // scan del
        .mockResolvedValueOnce(0) // scan del (empty)
        .mockResolvedValueOnce(1) // recent_native
        .mockResolvedValueOnce(1); // spotlight

      await service.handleUserMetricsUpdated();

      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'daily_recommendations:*',
        'COUNT',
        100,
      );
      expect(mockRedis.del).toHaveBeenCalledWith('discovery:recent_native');
      expect(mockRedis.del).toHaveBeenCalledWith('discovery:spotlight');
    });
  });

  describe('handleNewUserOnboarded', () => {
    it('should invalidate shared caches and partner search for all users', async () => {
      mockRedis.scan.mockResolvedValue([
        '0',
        ['discovery:partner_search:user:a:xyz'],
      ]);
      mockRedis.del.mockResolvedValue(1);

      await service.handleNewUserOnboarded();

      expect(mockRedis.del).toHaveBeenCalledWith('discovery:recent_native');
      expect(mockRedis.del).toHaveBeenCalledWith('discovery:spotlight');
      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'discovery:partner_search:user:*',
        'COUNT',
        100,
      );
    });
  });

  describe('handleUserDiscoveryCleared', () => {
    it('should delete exact keys and scan-delete prefixed patterns for a user', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['0', ['discovery:partner_search:user:u3:abc']])
        .mockResolvedValueOnce(['0', []])
        .mockResolvedValueOnce(['0', []])
        .mockResolvedValueOnce(['0', []]);
      mockRedis.del.mockResolvedValue(1);

      await service.handleUserDiscoveryCleared({ userId: 'u3' });

      // Exact key deletions: daily_recommendations:u3, recommendations:daily:u3,
      // discovery:partner_search:user:u3, discovery:language_pair:user:u3,
      // discovery:location_search:user:u3, discovery:audio_intros:user:u3
      expect(mockRedis.del).toHaveBeenCalledWith('daily_recommendations:u3');
      expect(mockRedis.del).toHaveBeenCalledWith('recommendations:daily:u3');
      expect(mockRedis.del).toHaveBeenCalledWith(
        'discovery:partner_search:user:u3',
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        'discovery:language_pair:user:u3',
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        'discovery:location_search:user:u3',
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        'discovery:audio_intros:user:u3',
      );
    });

    it('should not throw if no keys matched', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);
      mockRedis.del.mockResolvedValue(0);

      await expect(
        service.handleUserDiscoveryCleared({ userId: 'u-none' }),
      ).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Public helpers
  // -------------------------------------------------------------------------
  describe('deleteKey', () => {
    it('should delete a specific key', async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await service.deleteKey('partner_of_week_ids');

      expect(result).toBe(1);
      expect(mockRedis.del).toHaveBeenCalledWith('partner_of_week_ids');
    });

    it('should return 0 when key does not exist', async () => {
      mockRedis.del.mockResolvedValue(0);

      const result = await service.deleteKey('nonexistent_key');

      expect(result).toBe(0);
    });

    it('should return 0 on error', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis down'));

      const result = await service.deleteKey('partner_of_week_ids');

      expect(result).toBe(0);
    });
  });

  describe('deleteByPattern', () => {
    it('should scan and delete all matching keys', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['5', ['a:1', 'a:2']])
        .mockResolvedValueOnce(['0', ['a:3']]);
      mockRedis.del.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

      const result = await service.deleteByPattern('a:*');

      expect(result).toBe(3);
      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
    });

    it('should return 0 when no keys match', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);

      const result = await service.deleteByPattern('no:match:*');

      expect(result).toBe(0);
    });

    it('should return 0 on error', async () => {
      mockRedis.scan.mockRejectedValue(new Error('Redis scan error'));

      const result = await service.deleteByPattern('err:*');

      expect(result).toBe(0);
    });
  });

  describe('buildUserCacheKey', () => {
    it('should produce a correctly formatted key', () => {
      const key = service.buildUserCacheKey(
        'partner_search',
        'user-abc',
        'a1b2c3',
      );

      expect(key).toBe('discovery:partner_search:user:user-abc:a1b2c3');
    });

    it('should handle special characters in endpoint and hash', () => {
      const key = service.buildUserCacheKey(
        'language_pair',
        '861f9c19-349d-4d79-babb-95c0a0b8bf21',
        'es-en-A1',
      );

      expect(key).toBe(
        'discovery:language_pair:user:861f9c19-349d-4d79-babb-95c0a0b8bf21:es-en-A1',
      );
    });
  });
});

import type { Mock } from 'vitest';
/// <reference types="vi" />
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { MatchmakingCacheInvalidationService } from './matchmaking-cache-invalidation.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('MatchmakingCacheInvalidationService', () => {
  let service: MatchmakingCacheInvalidationService;
  let mockRedis: Record<string, Mock>;

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

    mockRedis = {
      del: vi.fn(),
      scan: vi.fn(),
    };
    mockRedis.del.mockResolvedValue(0);
    mockRedis.scan.mockResolvedValue(['0', []]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchmakingCacheInvalidationService,
        {
          provide: SupabaseService,
          useValue: {
            getRedisClient: vi.fn().mockReturnValue(mockRedis),
          },
        },
      ],
    }).compile();

    service = module.get<MatchmakingCacheInvalidationService>(
      MatchmakingCacheInvalidationService,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('invalidateUserMatchmakingCaches', () => {
    it('should delete daily_recommendations and recommendations:daily keys for the user', async () => {
      mockRedis.del.mockResolvedValue(2);

      await service.invalidateUserMatchmakingCaches('user-1');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'daily_recommendations:user-1',
        'recommendations:daily:user-1',
      );
    });

    it('should log when keys are deleted', async () => {
      const logSpy = vi.spyOn(Logger.prototype, 'log');
      mockRedis.del.mockResolvedValue(2);

      await service.invalidateUserMatchmakingCaches('user-1');

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalidated 2 matchmaking cache key(s)'),
      );
    });

    it('should not log when no keys are deleted', async () => {
      const logSpy = vi.spyOn(Logger.prototype, 'log');
      mockRedis.del.mockResolvedValue(0);

      await service.invalidateUserMatchmakingCaches('user-1');

      expect(logSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Invalidated'),
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis down'));

      await expect(
        service.invalidateUserMatchmakingCaches('user-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('invalidatePartnerOfWeekCache', () => {
    it('should delete partner_of_week_ids key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.invalidatePartnerOfWeekCache();

      expect(mockRedis.del).toHaveBeenCalledWith('partner_of_week_ids');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis down'));

      await expect(
        service.invalidatePartnerOfWeekCache(),
      ).resolves.toBeUndefined();
    });
  });

  describe('invalidateAfterProfileUpdate', () => {
    it('should delete user-specific keys and partner_of_week_ids', async () => {
      mockRedis.del
        .mockResolvedValueOnce(2) // user keys
        .mockResolvedValueOnce(1); // partner_of_week_ids

      await service.invalidateAfterProfileUpdate('user-1');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'daily_recommendations:user-1',
        'recommendations:daily:user-1',
      );
      expect(mockRedis.del).toHaveBeenCalledWith('partner_of_week_ids');
    });

    it('should handle errors in either Redis call gracefully', async () => {
      mockRedis.del
        .mockResolvedValueOnce(2)
        .mockRejectedValueOnce(new Error('Redis down'));

      await expect(
        service.invalidateAfterProfileUpdate('user-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('invalidateStaleRecommendationCaches', () => {
    it('should delete keys for users not in the processed set', async () => {
      mockRedis.scan
        .mockResolvedValueOnce([
          '0',
          ['daily_recommendations:u1', 'daily_recommendations:u2'],
        ])
        .mockResolvedValueOnce([
          '0',
          ['recommendations:daily:u1', 'recommendations:daily:u3'],
        ]);
      mockRedis.del.mockResolvedValue(3);

      await service.invalidateStaleRecommendationCaches(['u1']);

      // u2 and u3 are stale (not in processed set): daily_recommendations:u2,
      // recommendations:daily:u3
      expect(mockRedis.del).toHaveBeenCalledWith(
        'daily_recommendations:u2',
        'recommendations:daily:u3',
      );
    });

    it('should not delete anything when all users are processed', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['0', ['daily_recommendations:u1']])
        .mockResolvedValueOnce(['0', ['recommendations:daily:u1']]);

      await service.invalidateStaleRecommendationCaches(['u1']);

      // del should not be called with any stale keys
      const delCalls = mockRedis.del.mock.calls;
      const staleDelCall = delCalls.find((call: string[]) => call.length > 0);
      expect(staleDelCall).toBeUndefined();
    });

    it('should handle Redis scan errors gracefully', async () => {
      mockRedis.scan.mockRejectedValue(new Error('Redis scan error'));

      await expect(
        service.invalidateStaleRecommendationCaches(['u1']),
      ).resolves.toBeUndefined();
    });

    it('should handle del errors gracefully after successful scan', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', ['daily_recommendations:u1']]);
      mockRedis.del.mockRejectedValue(new Error('Redis del error'));

      await service.invalidateStaleRecommendationCaches([]);

      // Should not throw - error should be caught and logged
    });
  });
});

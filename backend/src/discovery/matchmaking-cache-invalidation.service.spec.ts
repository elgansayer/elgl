import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { MatchmakingCacheInvalidationService } from './matchmaking-cache-invalidation.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('MatchmakingCacheInvalidationService', () => {
  let service: MatchmakingCacheInvalidationService;
  let mockRedis: Record<string, jest.Mock>;
  let mockSupabaseService: { getRedisClient: jest.Mock };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

    mockRedis = {
      del: jest.fn(),
      keys: jest.fn(),
      scan: jest.fn(),
    };

    mockRedis.del.mockResolvedValue(0);
    mockRedis.keys.mockResolvedValue([]);
    mockRedis.scan.mockResolvedValue(['0', []]);

    mockSupabaseService = {
      getRedisClient: jest.fn().mockReturnValue(mockRedis),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchmakingCacheInvalidationService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<MatchmakingCacheInvalidationService>(
      MatchmakingCacheInvalidationService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('invalidateUserMatchmakingCaches', () => {
    it('should delete per-user recommendation keys', async () => {
      mockRedis.del.mockResolvedValue(2);

      await service.invalidateUserMatchmakingCaches('user-1');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'daily_recommendations:user-1',
        'recommendations:daily:user-1',
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis connection lost'));

      await expect(
        service.invalidateUserMatchmakingCaches('user-1'),
      ).resolves.toBeUndefined();
    });

    it('should log when keys are deleted', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.invalidateUserMatchmakingCaches('user-x');

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Invalidated 1 matchmaking cache key(s) for user user-x',
      );
    });
  });

  describe('invalidatePartnerOfWeekCache', () => {
    it('should delete the global partner_of_week_ids key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.invalidatePartnerOfWeekCache();

      expect(mockRedis.del).toHaveBeenCalledWith('partner_of_week_ids');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.invalidatePartnerOfWeekCache(),
      ).resolves.toBeUndefined();
    });
  });

  describe('invalidateAllMatchmakingCaches', () => {
    it('should delete exact key partner_of_week_ids and scan prefix patterns', async () => {
      mockRedis.del
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      await service.invalidateAllMatchmakingCaches();

      expect(mockRedis.del).toHaveBeenCalledWith('partner_of_week_ids');
      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'recommendations:daily:*',
        'COUNT',
        500,
      );
      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'daily_recommendations:*',
        'COUNT',
        500,
      );
    });

    it('should handle multiple scan iterations', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['1', ['recommendations:daily:user-a']])
        .mockResolvedValueOnce(['0', ['recommendations:daily:user-b']])
        .mockResolvedValueOnce(['0', []]);
      mockRedis.del
        .mockResolvedValueOnce(0) // partner_of_week_ids
        .mockResolvedValueOnce(1) // scan batch 1 for recommendations:daily
        .mockResolvedValueOnce(1) // scan batch 2 for recommendations:daily
        .mockResolvedValueOnce(0); // scan for daily_recommendations

      await service.invalidateAllMatchmakingCaches();

      expect(mockRedis.del).toHaveBeenCalledWith(
        'recommendations:daily:user-a',
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        'recommendations:daily:user-b',
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.invalidateAllMatchmakingCaches(),
      ).resolves.toBeUndefined();
    });
  });
});

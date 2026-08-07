import { Test } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
  DiscoveryCacheInvalidationService,
} from './discovery-cache-invalidation.service';
import {
  DiscoveryCacheNamespace,
  CacheInvalidationTrigger,
} from './interfaces/cache-rules.interface';
import { SupabaseService } from '../supabase/supabase.service';

describe('DiscoveryCacheInvalidationService', () => {
  let service: DiscoveryCacheInvalidationService;
  let mockRedisDel: jest.Mock;
  let mockRedisScan: jest.Mock;

  beforeEach(async () => {
    mockRedisDel = jest.fn().mockResolvedValue(1);
    mockRedisScan = jest.fn().mockResolvedValue(['0', []]); // cursor 0, no keys

    const mockRedis = {
      del: mockRedisDel,
      scan: mockRedisScan,
    };

    const mockSupabaseService = {
      getRedisClient: jest.fn().mockReturnValue(mockRedis),
    };

    const module = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        DiscoveryCacheInvalidationService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get(DiscoveryCacheInvalidationService);
  });

  describe('rules', () => {
    it('should define rules for all four invalidation triggers', () => {
      expect(service.rules).toHaveLength(4);
      const triggers = service.rules.flatMap((r) => r.triggers);
      expect(triggers).toContain(CacheInvalidationTrigger.PARTNER_OF_WEEK_UPDATED);
      expect(triggers).toContain(CacheInvalidationTrigger.RECOMMENDATIONS_UPDATED);
      expect(triggers).toContain(CacheInvalidationTrigger.USER_PROFILE_UPDATED);
      expect(triggers).toContain(CacheInvalidationTrigger.USER_DATA_CLEARED);
    });

    it('should have a PARTNER_OF_WEEK_UPDATED rule with exact key pattern', () => {
      const rule = service.rules.find(
        (r) => r.triggers.includes(CacheInvalidationTrigger.PARTNER_OF_WEEK_UPDATED),
      );
      expect(rule).toBeDefined();
      expect(rule!.patterns).toContain('partner_of_week_ids');
    });

    it('should have RECOMMENDATIONS_UPDATED/USER_PROFILE_UPDATED/USER_DATA_CLEARED rules with wildcard pattern', () => {
      const triggers = [
        CacheInvalidationTrigger.RECOMMENDATIONS_UPDATED,
        CacheInvalidationTrigger.USER_PROFILE_UPDATED,
        CacheInvalidationTrigger.USER_DATA_CLEARED,
      ];
      for (const trigger of triggers) {
        const rule = service.rules.find((r) => r.triggers.includes(trigger));
        expect(rule).toBeDefined();
        expect(rule!.patterns).toContain('daily_recommendations:*');
      }
    });
  });

  describe('buildKey', () => {
    it('should build exact partner_of_week_ids key', () => {
      expect(
        service.buildKey({ namespace: DiscoveryCacheNamespace.PARTNER_OF_WEEK }),
      ).toBe('partner_of_week_ids');
    });

    it('should build user-scoped daily_recommendations key', () => {
      expect(
        service.buildKey({
          namespace: DiscoveryCacheNamespace.DAILY_RECOMMENDATIONS,
          userId: 'user-abc',
        }),
      ).toBe('daily_recommendations:user-abc');
    });
  });

  describe('deleteKey', () => {
    it('should call redis.del with the exact key', async () => {
      await service.deleteKey('test-key');
      expect(mockRedisDel).toHaveBeenCalledWith('test-key');
    });

    it('should log error and not throw when del fails', async () => {
      mockRedisDel.mockRejectedValueOnce(new Error('redis down'));
      await expect(service.deleteKey('test-key')).resolves.toBeUndefined();
    });
  });

  describe('deletePattern', () => {
    it('should scan and delete matching keys', async () => {
      mockRedisScan
        .mockResolvedValueOnce(['1', ['key-a', 'key-b']])
        .mockResolvedValueOnce(['0', []]);
      mockRedisDel.mockResolvedValue(2);

      const deleted = await service.deletePattern('daily_recommendations:*');

      expect(deleted).toBe(2);
      expect(mockRedisScan).toHaveBeenCalledTimes(2);
      expect(mockRedisDel).toHaveBeenCalledWith('key-a', 'key-b');
    });

    it('should return 0 when no keys match', async () => {
      mockRedisScan.mockResolvedValue(['0', []]);
      const deleted = await service.deletePattern('nonexistent:*');
      expect(deleted).toBe(0);
    });

    it('should log error and not throw when scan fails', async () => {
      mockRedisScan.mockRejectedValueOnce(new Error('redis down'));
      const deleted = await service.deletePattern('daily_recommendations:*');
      expect(deleted).toBe(0);
    });
  });

  describe('invalidateUserRecommendations', () => {
    it('should delete the user-scoped key', async () => {
      await service.invalidateUserRecommendations('user-1');
      expect(mockRedisDel).toHaveBeenCalledWith('daily_recommendations:user-1');
    });
  });

  describe('invalidatePartnerOfWeek', () => {
    it('should delete the global partner_of_week_ids key', async () => {
      await service.invalidatePartnerOfWeek();
      expect(mockRedisDel).toHaveBeenCalledWith('partner_of_week_ids');
    });
  });

  describe('event-driven invalidation', () => {
    describe('user.profile_updated', () => {
      it('should invalidate all daily_recommendations:* keys', async () => {
        mockRedisScan
          .mockResolvedValueOnce(['0', ['daily_recommendations:u1', 'daily_recommendations:u2']]);
        mockRedisDel.mockResolvedValue(2);

        const emitter = (service as any).handleUserProfileUpdated;
        await emitter.call(service, { userId: 'target-user' });

        expect(mockRedisScan).toHaveBeenCalledWith(
          '0',
          'MATCH',
          'daily_recommendations:*',
          'COUNT',
          500,
        );
      });

      it('should handle scan returning 0 matching keys', async () => {
        mockRedisScan.mockResolvedValue(['0', []]);
        const emitter = (service as any).handleUserProfileUpdated;
        await emitter.call(service, { userId: 'target-user' });
        // no error thrown, no del called other than scan
      });
    });

    describe('user.deleted', () => {
      it('should delete user key and broad-invalidate all daily recs', async () => {
        mockRedisDel
          .mockResolvedValueOnce(1) // del of userKey
          .mockResolvedValueOnce(2); // del of pattern scan results
        mockRedisScan
          .mockResolvedValueOnce(['0', ['daily_recommendations:u1', 'daily_recommendations:u2']]);

        const emitter = (service as any).handleUserDeleted;
        await emitter.call(service, { userId: 'removed-user' });

        expect(mockRedisDel).toHaveBeenCalledWith('daily_recommendations:removed-user');
        expect(mockRedisScan).toHaveBeenCalledWith(
          '0',
          'MATCH',
          'daily_recommendations:*',
          'COUNT',
          500,
        );
      });

      it('should handle redis error gracefully', async () => {
        mockRedisDel.mockRejectedValue(new Error('redis down'));
        const emitter = (service as any).handleUserDeleted;
        await emitter.call(service, { userId: 'removed-user' });
        // should not throw
      });
    });
  });
});
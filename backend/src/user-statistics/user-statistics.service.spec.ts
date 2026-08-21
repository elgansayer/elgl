import type { Mock } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { UserStatisticsService } from './user-statistics.service';
import { SupabaseService } from '../supabase/supabase.service';

function createQueryBuilder(result: Record<string, unknown>): any {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    then(resolve: (value: unknown) => void) {
      resolve(result);
    },
  };
}

describe('UserStatisticsService', () => {
  let service: UserStatisticsService;
  let mockClient: { from: Mock };
  let mockSupabase: { getClient: Mock };

  beforeEach(() => {
    mockClient = {
      from: vi.fn(),
    };
    mockSupabase = {
      getClient: vi.fn().mockReturnValue(mockClient),
    };
    service = new UserStatisticsService(
      mockSupabase as unknown as SupabaseService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserStatistics', () => {
    it('should return aggregated statistics without date filters', async () => {
      const userBuilder = createQueryBuilder({
        data: {
          study_streak_days: 5,
          correction_ratio: 0.75,
          coins_balance: 120,
          created_at: '2024-01-01T00:00:00Z',
          is_vip: true,
        },
        error: null,
      });
      const momentCountBuilder = createQueryBuilder({ count: 3 });
      const commentCountBuilder = createQueryBuilder({ count: 7 });
      const momentIdsBuilder = createQueryBuilder({
        data: [{ id: 'moment-1' }, { id: 'moment-2' }],
        error: null,
      });
      const likeCountBuilder = createQueryBuilder({ count: 9 });
      const visitCountBuilder = createQueryBuilder({ count: 4 });

      let momentsCalls = 0;
      mockClient.from.mockImplementation((table: string) => {
        if (table === 'users') return userBuilder;
        if (table === 'moments') {
          momentsCalls += 1;
          return momentsCalls === 1 ? momentCountBuilder : momentIdsBuilder;
        }
        if (table === 'moment_comments') return commentCountBuilder;
        if (table === 'moment_likes') return likeCountBuilder;
        if (table === 'profile_visits') return visitCountBuilder;
        throw new Error(`Unexpected table: ${table}`);
      });

      const result = await service.getUserStatistics('user-1');

      expect(result).toEqual({
        studyStreakDays: 5,
        correctionRatio: 0.75,
        coinsBalance: 120,
        isVip: true,
        accountCreatedAt: '2024-01-01T00:00:00Z',
        totalMoments: 3,
        totalComments: 7,
        totalLikesReceived: 9,
        totalProfileVisits: 4,
      });
    });

    it('should apply fromDate and toDate filters to relevant queries', async () => {
      const fromDate = '2024-01-01';
      const toDate = '2024-12-31';

      const userBuilder = createQueryBuilder({
        data: {
          study_streak_days: 0,
          correction_ratio: 0,
          coins_balance: 0,
          created_at: '2023-06-06T00:00:00Z',
          is_vip: false,
        },
        error: null,
      });
      const momentCountBuilder = createQueryBuilder({ count: 5 });
      const commentCountBuilder = createQueryBuilder({ count: 2 });
      const momentIdsBuilder = createQueryBuilder({
        data: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
        error: null,
      });
      const likeCountBuilder = createQueryBuilder({ count: 1 });
      const visitCountBuilder = createQueryBuilder({ count: 10 });

      let momentsCalls = 0;
      mockClient.from.mockImplementation((table: string) => {
        if (table === 'users') return userBuilder;
        if (table === 'moments') {
          momentsCalls += 1;
          return momentsCalls === 1 ? momentCountBuilder : momentIdsBuilder;
        }
        if (table === 'moment_comments') return commentCountBuilder;
        if (table === 'moment_likes') return likeCountBuilder;
        if (table === 'profile_visits') return visitCountBuilder;
        throw new Error(`Unexpected table: ${table}`);
      });

      await service.getUserStatistics('user-1', { fromDate, toDate });

      expect(momentCountBuilder.gte).toHaveBeenCalledWith(
        'created_at',
        fromDate,
      );
      expect(momentCountBuilder.lte).toHaveBeenCalledWith('created_at', toDate);

      expect(commentCountBuilder.gte).toHaveBeenCalledWith(
        'created_at',
        fromDate,
      );
      expect(commentCountBuilder.lte).toHaveBeenCalledWith(
        'created_at',
        toDate,
      );

      expect(momentIdsBuilder.gte).toHaveBeenCalledWith('created_at', fromDate);
      expect(momentIdsBuilder.lte).toHaveBeenCalledWith('created_at', toDate);

      expect(visitCountBuilder.gte).toHaveBeenCalledWith(
        'created_at',
        fromDate,
      );
      expect(visitCountBuilder.lte).toHaveBeenCalledWith('created_at', toDate);
    });

    it('should throw NotFoundException when user is missing', async () => {
      mockClient.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return createQueryBuilder({
            data: null,
            error: { message: 'User not found' },
          });
        }
        throw new Error(`Unexpected table: ${table}`);
      });

      await expect(service.getUserStatistics('missing-user')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when moment IDs query fails', async () => {
      const userBuilder = createQueryBuilder({
        data: {
          study_streak_days: 1,
          correction_ratio: 0.1,
          coins_balance: 10,
          created_at: '2024-01-01',
          is_vip: false,
        },
        error: null,
      });
      const momentCountBuilder = createQueryBuilder({ count: 1 });
      const commentCountBuilder = createQueryBuilder({ count: 0 });
      const failingMomentIdsBuilder = createQueryBuilder({
        data: null,
        error: { message: 'moment ids failed' },
      });

      let momentsCalls = 0;
      mockClient.from.mockImplementation((table: string) => {
        if (table === 'users') return userBuilder;
        if (table === 'moments') {
          momentsCalls += 1;
          return momentsCalls === 1
            ? momentCountBuilder
            : failingMomentIdsBuilder;
        }
        if (table === 'moment_comments') return commentCountBuilder;
        throw new Error(`Unexpected table: ${table}`);
      });

      await expect(service.getUserStatistics('user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

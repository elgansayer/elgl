import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardService } from './leaderboard.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('LeaderboardService', () => {
  let service: LeaderboardService;
  let mockSupabaseClient: { from: jest.Mock };
  let mockSupabaseService: { getClient: jest.Mock };
  let selectBuilder: { select: jest.Mock };
  let orderBuilder: { order: jest.Mock };
  let limitBuilder: { limit: jest.Mock };

  beforeEach(async () => {
    limitBuilder = {
      limit: jest.fn(),
    };

    orderBuilder = {
      order: jest.fn().mockReturnValue(limitBuilder),
    };

    selectBuilder = {
      select: jest.fn().mockReturnValue(orderBuilder),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(selectBuilder),
    };

    mockSupabaseService = {
      getClient: jest.fn().mockReturnValue(mockSupabaseClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<LeaderboardService>(LeaderboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTopCorrectors', () => {
    it('returns a list of correctors ordered by correction_ratio descending', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          display_name: 'Alice',
          avatar_url: 'https://example.com/alice.jpg',
          correction_ratio: 0.95,
          study_streak_days: 30,
        },
        {
          id: 'user-2',
          display_name: 'Bob',
          avatar_url: null,
          correction_ratio: 0.88,
          study_streak_days: 5,
        },
      ];

      limitBuilder.limit.mockResolvedValue({ data: mockUsers, error: null });

      const result = await service.getTopCorrectors(20);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(selectBuilder.select).toHaveBeenCalledWith(
        'id, display_name, avatar_url, correction_ratio, study_streak_days',
      );
      expect(orderBuilder.order).toHaveBeenCalledWith('correction_ratio', {
        ascending: false,
      });
      expect(limitBuilder.limit).toHaveBeenCalledWith(20);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'user-1',
        display_name: 'Alice',
        avatar_url: 'https://example.com/alice.jpg',
        correction_ratio: 0.95,
        study_streak_days: 30,
        is_serious_learner: true,
      });
      expect(result[1]).toMatchObject({
        id: 'user-2',
        display_name: 'Bob',
        avatar_url: null,
        correction_ratio: 0.88,
        study_streak_days: 5,
        is_serious_learner: false,
      });
    });

    it('marks users as serious learner when streak > 7 and ratio >= 0.8', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          display_name: 'Alice',
          avatar_url: null,
          correction_ratio: 0.79,
          study_streak_days: 30,
        },
        {
          id: 'user-2',
          display_name: 'Bob',
          avatar_url: null,
          correction_ratio: 0.95,
          study_streak_days: 3,
        },
        {
          id: 'user-3',
          display_name: 'Charlie',
          avatar_url: null,
          correction_ratio: 0.8,
          study_streak_days: 8,
        },
      ];

      limitBuilder.limit.mockResolvedValue({ data: mockUsers, error: null });

      const result = await service.getTopCorrectors();

      // Alice: ratio < 0.8 → not serious
      expect(result[0].is_serious_learner).toBe(false);
      // Bob: streak <= 7 → not serious
      expect(result[1].is_serious_learner).toBe(false);
      // Charlie: ratio >= 0.8 AND streak > 7 → serious
      expect(result[2].is_serious_learner).toBe(true);
    });

    it('handles null study_streak_days and correction_ratio gracefully', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          display_name: 'Alice',
          avatar_url: null,
          correction_ratio: null,
          study_streak_days: null,
        },
      ];

      limitBuilder.limit.mockResolvedValue({ data: mockUsers, error: null });

      const result = await service.getTopCorrectors();

      expect(result[0].correction_ratio).toBeNull();
      expect(result[0].study_streak_days).toBeNull();
      expect(result[0].is_serious_learner).toBe(false);
    });

    it('returns an empty array when no users are found', async () => {
      limitBuilder.limit.mockResolvedValue({ data: [], error: null });

      const result = await service.getTopCorrectors();

      expect(result).toEqual([]);
    });

    it('throws an error when supabase returns an error', async () => {
      limitBuilder.limit.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      await expect(service.getTopCorrectors()).rejects.toThrow(
        'Failed to fetch top correctors: Database connection failed',
      );
    });

    it('uses default limit of 20 when not specified', async () => {
      limitBuilder.limit.mockResolvedValue({ data: [], error: null });

      await service.getTopCorrectors();

      expect(limitBuilder.limit).toHaveBeenCalledWith(20);
    });

    it('uses the provided limit when specified', async () => {
      limitBuilder.limit.mockResolvedValue({ data: [], error: null });

      await service.getTopCorrectors(10);

      expect(limitBuilder.limit).toHaveBeenCalledWith(10);
    });

    it('handles null data gracefully (returns empty array)', async () => {
      limitBuilder.limit.mockResolvedValue({ data: null, error: null });

      const result = await service.getTopCorrectors();

      expect(result).toEqual([]);
    });
  });
});
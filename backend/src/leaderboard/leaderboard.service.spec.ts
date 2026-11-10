import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardService } from './leaderboard.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('LeaderboardService', () => {
  let service: LeaderboardService;

  const mockUsers = [
    {
      id: 'user-1',
      display_name: 'Alice',
      avatar_url: 'https://example.com/alice.png',
      correction_ratio: 0.95,
      study_streak_days: 120,
    },
    {
      id: 'user-2',
      display_name: 'Bob',
      avatar_url: null,
      correction_ratio: 0.88,
      study_streak_days: 30,
    },
    {
      id: 'user-3',
      display_name: 'Charlie',
      avatar_url: 'https://example.com/charlie.png',
      correction_ratio: 0.45,
      study_streak_days: 3,
    },
  ];

  function setupService(
    supabaseData: unknown,
    supabaseError: unknown | null = null,
  ) {
    const fakeChain = Promise.resolve({
      data: supabaseData,
      error: supabaseError,
    });

    const mockLimit = vi.fn().mockReturnValue(fakeChain);
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });

    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: mockSelect,
      }),
    };

    return { mockClient, mockSelect, mockOrder, mockLimit };
  }

  async function createService(mockClient: unknown) {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        {
          provide: SupabaseService,
          useValue: { getClient: vi.fn().mockReturnValue(mockClient) },
        },
      ],
    }).compile();

    return moduleRef.get<LeaderboardService>(LeaderboardService);
  }

  it('should be defined', async () => {
    const { mockClient } = setupService([]);
    service = await createService(mockClient);
    expect(service).toBeDefined();
  });

  function setupRpcService(rpcResult: { data: unknown; error: unknown }) {
    const mockRpc = vi.fn().mockResolvedValue(rpcResult);
    const mockClient = { rpc: mockRpc };

    return { mockRpc, mockClient };
  }

  describe('getWeeklyLeaderboard', () => {
    it('splits corrector and study-hour rows into their categories', async () => {
      const { mockClient, mockRpc } = setupRpcService({
        data: [
          {
            category: 'correctors',
            user_id: 'user-1',
            display_name: 'Alice',
            avatar_url: 'https://example.com/alice.png',
            score: 12,
          },
          {
            category: 'study_hours',
            user_id: 'user-2',
            display_name: 'Bob',
            avatar_url: null,
            score: 4.5,
          },
        ],
        error: null,
      });
      service = await createService(mockClient);

      const result = await service.getWeeklyLeaderboard(10);

      expect(mockRpc).toHaveBeenCalledWith('get_weekly_leaderboard', {
        p_limit: 10,
      });
      expect(result.correctors).toEqual([
        {
          user_id: 'user-1',
          display_name: 'Alice',
          avatar_url: 'https://example.com/alice.png',
          score: 12,
        },
      ]);
      expect(result.study_hours).toEqual([
        {
          user_id: 'user-2',
          display_name: 'Bob',
          avatar_url: null,
          score: 4.5,
        },
      ]);
    });

    it('accepts numeric scores returned as strings', async () => {
      const { mockClient } = setupRpcService({
        data: [
          {
            category: 'study_hours',
            user_id: 'user-2',
            display_name: null,
            avatar_url: null,
            score: '3.7',
          },
        ],
        error: null,
      });
      service = await createService(mockClient);

      const result = await service.getWeeklyLeaderboard();

      expect(result.study_hours[0].score).toBe(3.7);
    });

    it('clamps oversized limits before calling the database', async () => {
      const { mockClient, mockRpc } = setupRpcService({
        data: [],
        error: null,
      });
      service = await createService(mockClient);

      await service.getWeeklyLeaderboard(5000);

      expect(mockRpc).toHaveBeenCalledWith('get_weekly_leaderboard', {
        p_limit: 100,
      });
    });

    it('throws when the RPC returns an error', async () => {
      const { mockClient } = setupRpcService({
        data: null,
        error: { message: 'Database connection failed' },
      });
      service = await createService(mockClient);

      await expect(service.getWeeklyLeaderboard()).rejects.toThrow(
        'Failed to fetch weekly leaderboard: Database connection failed',
      );
    });

    it('throws when the RPC returns an invalid row', async () => {
      const { mockClient } = setupRpcService({
        data: [{ category: 'correctors', user_id: 42, score: 1 }],
        error: null,
      });
      service = await createService(mockClient);

      await expect(service.getWeeklyLeaderboard()).rejects.toThrow(
        'Failed to fetch weekly leaderboard: invalid result',
      );
    });
  });

  describe('getTopCorrectors', () => {
    it('should return mapped correctors with serious learner flag', async () => {
      const { mockClient, mockSelect, mockOrder, mockLimit } =
        setupService(mockUsers);
      service = await createService(mockClient);

      const result = await service.getTopCorrectors(20);

      expect(mockSelect).toHaveBeenCalledWith(
        'id, display_name, avatar_url, correction_ratio, study_streak_days',
      );
      expect(mockOrder).toHaveBeenCalledWith('correction_ratio', {
        ascending: false,
      });
      expect(mockLimit).toHaveBeenCalledWith(20);
      expect(result).toHaveLength(3);
      expect(result[0].is_serious_learner).toBe(true);
      expect(result[1].is_serious_learner).toBe(true);
      expect(result[2].is_serious_learner).toBe(false);
    });

    it('should handle null/undefined values gracefully', async () => {
      const nullUser = {
        id: 'user-x',
        display_name: null,
        avatar_url: null,
        correction_ratio: null,
        study_streak_days: null,
      };
      const { mockClient } = setupService([nullUser]);
      service = await createService(mockClient);

      const result = await service.getTopCorrectors(10);

      expect(result).toHaveLength(1);
      expect(result[0].display_name).toBeNull();
      expect(result[0].correction_ratio).toBeNull();
      expect(result[0].is_serious_learner).toBe(false);
    });

    it('should throw if supabase returns an error', async () => {
      const { mockClient } = setupService(null, {
        message: 'Database connection failed',
      });
      service = await createService(mockClient);

      await expect(service.getTopCorrectors(5)).rejects.toThrow(
        'Failed to fetch top correctors: Database connection failed',
      );
    });

    it('should return empty array when no data returned', async () => {
      const { mockClient } = setupService(null, null);
      service = await createService(mockClient);

      const result = await service.getTopCorrectors(5);

      expect(result).toEqual([]);
    });

    it('should use default limit of 20 when not specified', async () => {
      const { mockClient, mockLimit } = setupService([]);
      service = await createService(mockClient);

      await service.getTopCorrectors();

      expect(mockLimit).toHaveBeenCalledWith(20);
    });
  });
});

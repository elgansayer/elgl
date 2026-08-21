import { Test, TestingModule } from '@nestjs/testing';
import { BlocksService } from './blocks.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from '../metrics/metrics.service';

describe('BlocksService', () => {
  let service: BlocksService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;
  let mockMetricsService: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      match: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: any) => resolve(mockQueryBuilder._response)),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    mockMetricsService = {
      recordTsReportSubmitted: vi.fn(),
      recordTsBlockCreated: vi.fn(),
      recordTsBlockRemoved: vi.fn(),
      setTsPendingReports: vi.fn(),
      setTsActiveBlocksTotal: vi.fn(),
      recordTsModerationAction: vi.fn(),
      recordTsDatingRiskScore: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlocksService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get<BlocksService>(BlocksService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getBlockedUsers', () => {
    it('should return empty array when user has no blocks', async () => {
      mockQueryBuilder._response = {
        data: [],
        error: null,
      };

      const result = await service.getBlockedUsers('user-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blocks');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('blocked_id');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('blocker_id', 'user-1');
      expect(result).toEqual([]);
    });

    it('should return blocked user details when blocks exist', async () => {
      const mockBlocksBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn(),
      };

      mockBlocksBuilder.then.mockImplementation((resolve: any) =>
        resolve({
          data: [{ blocked_id: 'blocked-1' }, { blocked_id: 'blocked-2' }],
          error: null,
        }),
      );

      const mockUsersBuilder = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        then: vi.fn(),
      };

      mockUsersBuilder.then.mockImplementation((resolve: any) =>
        resolve({
          data: [
            {
              id: 'blocked-1',
              display_name: 'User One',
              avatar_url: null,
              native_language: 'en',
              target_languages: ['es'],
            },
            {
              id: 'blocked-2',
              display_name: 'User Two',
              avatar_url: '/img.png',
              native_language: 'fr',
              target_languages: ['de'],
            },
          ],
          error: null,
        }),
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'blocks') return mockBlocksBuilder;
        if (table === 'users') return mockUsersBuilder;
        return mockQueryBuilder;
      });

      const result = await service.getBlockedUsers('user-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'blocked-1',
        display_name: 'User One',
        avatar_url: null,
        native_language: 'en',
        target_languages: ['es'],
      });
    });

    it('should throw error when blocks query fails', async () => {
      mockQueryBuilder._response = {
        data: null,
        error: { message: 'db error' },
      };

      await expect(service.getBlockedUsers('user-1')).rejects.toThrow(
        'Failed to fetch blocked users: db error',
      );
    });

    it('should throw error when users query fails', async () => {
      const mockBlocksBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn(),
      };

      mockBlocksBuilder.then.mockImplementation((resolve: any) =>
        resolve({ data: [{ blocked_id: 'blocked-1' }], error: null }),
      );

      const mockUsersBuilder = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        then: vi.fn(),
      };

      mockUsersBuilder.then.mockImplementation((resolve: any) =>
        resolve({ data: null, error: { message: 'user fetch error' } }),
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'blocks') return mockBlocksBuilder;
        if (table === 'users') return mockUsersBuilder;
        return mockQueryBuilder;
      });

      await expect(service.getBlockedUsers('user-1')).rejects.toThrow(
        'Failed to fetch user details: user fetch error',
      );
    });

    it('should return empty array when users response data is null', async () => {
      const mockBlocksBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn(),
      };

      mockBlocksBuilder.then.mockImplementation((resolve: any) =>
        resolve({ data: [{ blocked_id: 'blocked-1' }], error: null }),
      );

      const mockUsersBuilder = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        then: vi.fn(),
      };

      mockUsersBuilder.then.mockImplementation((resolve: any) =>
        resolve({ data: null, error: null }),
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'blocks') return mockBlocksBuilder;
        if (table === 'users') return mockUsersBuilder;
        return mockQueryBuilder;
      });

      const result = await service.getBlockedUsers('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('unblockUser', () => {
    it('should delete the block record and return success', async () => {
      mockQueryBuilder._response = { error: null };

      const result = await service.unblockUser('user-1', 'blocked-user');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blocks');
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.match).toHaveBeenCalledWith({
        blocker_id: 'user-1',
        blocked_id: 'blocked-user',
      });
      expect(result).toEqual({ success: true });
    });

    it('should throw error when delete fails', async () => {
      mockQueryBuilder._response = {
        error: { message: 'delete failed' },
      };

      await expect(
        service.unblockUser('user-1', 'blocked-user'),
      ).rejects.toThrow('Failed to unblock user: delete failed');
    });
  });
});

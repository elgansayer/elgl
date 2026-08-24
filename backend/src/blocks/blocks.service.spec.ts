import { InternalServerErrorException } from '@nestjs/common';
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
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      match: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: any) => resolve(mockQueryBuilder._response)),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    mockMetricsService = {
      recordTsBlockRemoved: vi.fn(),
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

  describe('getBlockedUsers', () => {
    it('returns an empty bounded page when the user has no blocks', async () => {
      mockQueryBuilder._response = { data: [], error: null };

      const result = await service.getBlockedUsers('user-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blocks');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('blocked_id');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('blocker_id', 'user-1');
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockQueryBuilder.range).toHaveBeenCalledWith(0, 99);
      expect(result).toEqual([]);
    });

    it('preserves block recency order when profile query order differs', async () => {
      const blocksBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        then: vi.fn((resolve: any) =>
          resolve({
            data: [{ blocked_id: 'blocked-2' }, { blocked_id: 'blocked-1' }],
            error: null,
          }),
        ),
      };
      const usersBuilder = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        then: vi.fn((resolve: any) =>
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
                avatar_url: null,
                native_language: 'fr',
                target_languages: ['de'],
              },
            ],
            error: null,
          }),
        ),
      };

      mockSupabaseClient.from.mockImplementation((table: string) =>
        table === 'blocks' ? blocksBuilder : usersBuilder,
      );

      const result = await service.getBlockedUsers('user-1', 25, 50);

      expect(blocksBuilder.range).toHaveBeenCalledWith(50, 74);
      expect(usersBuilder.in).toHaveBeenCalledWith('id', ['blocked-2', 'blocked-1']);
      expect(result.map((user) => user.id)).toEqual(['blocked-2', 'blocked-1']);
    });

    it('clamps internal callers to the maximum page size and non-negative offset', async () => {
      mockQueryBuilder._response = { data: [], error: null };

      await service.getBlockedUsers('user-1', 1000, -40);

      expect(mockQueryBuilder.range).toHaveBeenCalledWith(0, 99);
    });

    it('fails with a sanitised error when either database query fails', async () => {
      mockQueryBuilder._response = { data: null, error: { message: 'private database detail' } };

      await expect(service.getBlockedUsers('user-1')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
      await expect(service.getBlockedUsers('user-1')).rejects.toThrow('Unable to load blocked users');
    });
  });

  describe('blockUser', () => {
    it('uses an idempotent upsert for retry-safe block creation', async () => {
      mockQueryBuilder._response = { error: null };

      const result = await service.blockUser('user-1', 'blocked-user');

      expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
        { blocker_id: 'user-1', blocked_id: 'blocked-user' },
        { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
      );
      expect(result).toEqual({ success: true });
    });

    it('rejects self-blocking without touching persistence', async () => {
      expect(await service.blockUser('user-1', 'user-1')).toEqual({ success: false });
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });
  });

  describe('unblockUser', () => {
    it('is retry-safe and records the successful removal metric', async () => {
      mockQueryBuilder._response = { error: null };

      const result = await service.unblockUser('user-1', 'blocked-user');

      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.match).toHaveBeenCalledWith({
        blocker_id: 'user-1',
        blocked_id: 'blocked-user',
      });
      expect(mockMetricsService.recordTsBlockRemoved).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true });
    });

    it('does not expose database error details when delete fails', async () => {
      mockQueryBuilder._response = { error: { message: 'delete failed: private detail' } };

      await expect(service.unblockUser('user-1', 'blocked-user')).rejects.toThrow(
        'Unable to update block state',
      );
      expect(mockMetricsService.recordTsBlockRemoved).not.toHaveBeenCalled();
    });
  });
});

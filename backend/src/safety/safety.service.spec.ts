import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SafetyService } from './safety.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from '../metrics/metrics.service';
import { SafetyCacheInvalidationService } from './safety-cache-invalidation.service';
import { Logger } from '@nestjs/common';

describe('SafetyService', () => {
  let service: SafetyService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;
  let mockMetricsService: any;
  let mockCacheInvalidationService: {
    invalidateTrustAndSafetyCaches: Mock;
    invalidateUserPairCaches: Mock;
    invalidateUserCaches: Mock;
  };

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    mockQueryBuilder = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockReturnThis(),
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

    mockCacheInvalidationService = {
      invalidateTrustAndSafetyCaches: vi.fn().mockResolvedValue(undefined),
      invalidateUserPairCaches: vi.fn().mockResolvedValue(undefined),
      invalidateUserCaches: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SafetyService,
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
        {
          provide: SafetyCacheInvalidationService,
          useValue: mockCacheInvalidationService,
        },
      ],
    }).compile();

    service = module.get<SafetyService>(SafetyService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reportUser', () => {
    it('should submit a report and return the report id', async () => {
      const dto = {
        reported_id: 'reported-1',
        reason_category: 'harassment',
        description: 'Harassed me',
        context_url: 'http://example.com',
      };

      // user existence check
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'reported-1' },
        error: null,
      });

      // report insertion
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'report-id' },
        error: null,
      });
      mockQueryBuilder._response = { error: null, data: { id: 'report-id' } };

      const logSpy = vi
        .spyOn((service as any).logger, 'log')
        .mockImplementation(() => {});

      const result = await service.reportUser('user-1', dto);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('reports');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        reporter_id: 'user-1',
        reported_user_id: dto.reported_id,
        reason_category: dto.reason_category,
        description: dto.description,
        context_url: dto.context_url,
        status: 'pending',
      });
      expect(mockMetricsService.recordTsReportSubmitted).toHaveBeenCalledWith(
        dto.reason_category,
      );
      expect(result).toEqual({ id: 'report-id' });
      expect(
        mockCacheInvalidationService.invalidateUserCaches,
      ).toHaveBeenCalledWith('reported-1');
      expect(
        mockCacheInvalidationService.invalidateTrustAndSafetyCaches,
      ).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('should throw when reporting self', async () => {
      await expect(
        service.reportUser('user-1', {
          reported_id: 'user-1',
          reason_category: 'harassment',
        }),
      ).rejects.toThrow('Cannot report yourself');
    });

    it('should throw when reported user does not exist', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'not found' },
      });

      await expect(
        service.reportUser('user-1', {
          reported_id: 'missing-user',
          reason_category: 'spam',
        }),
      ).rejects.toThrow('Reported user not found');
    });

    it('should throw when report insertion fails', async () => {
      const dto = {
        reported_id: 'reported-1',
        reason_category: 'spam',
        description: 'Spam words',
        context_url: null,
      };

      // user exists
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'reported-1' },
        error: null,
      });
      // insertion fails
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });
      mockQueryBuilder._response = {
        error: { message: 'Database error' },
        data: null,
      };

      await expect(service.reportUser('user-1', dto)).rejects.toThrow(
        'Failed to submit report',
      );
    });

    it('should throw when report insertion returns null data', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'reported-1' },
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });
      mockQueryBuilder._response = { data: null, error: null };

      await expect(
        service.reportUser('user-1', {
          reported_id: 'reported-1',
          reason_category: 'other',
        }),
      ).rejects.toThrow('Failed to submit report: no data returned');
    });
  });

  describe('blockUser', () => {
    it('should block a user successfully', async () => {
      // user existence check
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'blocked-user' },
        error: null,
      });
      // existing block check returns null
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });
      // insert succeeds
      mockQueryBuilder._response = { error: null };

      const logSpy = vi
        .spyOn((service as any).logger, 'log')
        .mockImplementation(() => {});

      const result = await service.blockUser('user-1', {
        blocked_id: 'blocked-user',
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blocks');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('id');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('blocker_id', 'user-1');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
        'blocked_id',
        'blocked-user',
      );
      expect(mockQueryBuilder.maybeSingle).toHaveBeenCalled();
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        blocker_id: 'user-1',
        blocked_id: 'blocked-user',
      });
      expect(logSpy).toHaveBeenCalledWith('User user-1 blocked blocked-user');
      expect(result).toEqual({ success: true, blocked_id: 'blocked-user' });
      expect(
        mockCacheInvalidationService.invalidateUserPairCaches,
      ).toHaveBeenCalledWith('user-1', 'blocked-user');
      expect(
        mockCacheInvalidationService.invalidateTrustAndSafetyCaches,
      ).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('should throw when blocking self', async () => {
      await expect(
        service.blockUser('user-1', { blocked_id: 'user-1' }),
      ).rejects.toThrow('You cannot block yourself');
    });

    it('should throw when target user does not exist', async () => {
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'not found' },
      });

      await expect(
        service.blockUser('user-1', { blocked_id: 'missing-user' }),
      ).rejects.toThrow('User to block not found');
    });

    it('should throw when the user is already blocked', async () => {
      // user existence check
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'blocked-user' },
        error: null,
      });
      // existing block exists
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'existing-block' },
        error: null,
      });

      await expect(
        service.blockUser('user-1', { blocked_id: 'blocked-user' }),
      ).rejects.toThrow('User is already blocked');
    });

    it('should throw when insert fails', async () => {
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'blocked-user' },
        error: null,
      });
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });
      mockQueryBuilder._response = { error: { message: 'db error' } };

      await expect(
        service.blockUser('user-1', { blocked_id: 'blocked-user' }),
      ).rejects.toThrow('Failed to block user: db error');
    });
  });

  describe('unblockUser', () => {
    it('should unblock a user', async () => {
      mockQueryBuilder._response = { error: null };

      const logSpy = vi
        .spyOn((service as any).logger, 'log')
        .mockImplementation(() => {});

      const result = await service.unblockUser('user-1', 'blocked-user');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blocks');
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('blocker_id', 'user-1');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
        'blocked_id',
        'blocked-user',
      );
      expect(result).toEqual({ success: true });
      expect(
        mockCacheInvalidationService.invalidateUserPairCaches,
      ).toHaveBeenCalledWith('user-1', 'blocked-user');
      expect(
        mockCacheInvalidationService.invalidateTrustAndSafetyCaches,
      ).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('should throw when delete fails', async () => {
      mockQueryBuilder._response = { error: { message: 'db error' } };

      await expect(
        service.unblockUser('user-1', 'blocked-user'),
      ).rejects.toThrow('Failed to unblock user: db error');
    });
  });

  describe('isBlocked', () => {
    it('should return true when block exists', async () => {
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'block-1' },
        error: null,
      });

      const result = await service.isBlocked('user-1', 'blocked-user');
      expect(result).toBe(true);
      expect(mockQueryBuilder.maybeSingle).toHaveBeenCalled();
    });

    it('should return false when block does not exist', async () => {
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await service.isBlocked('user-1', 'blocked-user');
      expect(result).toBe(false);
    });

    it('should return false on query error', async () => {
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'db error' },
      });

      const result = await service.isBlocked('user-1', 'blocked-user');
      expect(result).toBe(false);
    });
  });

  describe('getCategories', () => {
    it('should return safety categories', () => {
      const result = service.getCategories();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('value');
      expect(result[0]).toHaveProperty('label');
      expect(result[0]).toHaveProperty('icon');
      expect(result[0]).toHaveProperty('description');
    });
  });

  describe('getBlockedUserIds', () => {
    it('should return list of blocked user IDs for a user', async () => {
      // Build chain: from('blocks').select('blocked_id').eq('blocker_id', userId)
      mockQueryBuilder.then = vi.fn((resolve: any) =>
        resolve({
          data: [{ blocked_id: 'blocked-1' }, { blocked_id: 'blocked-2' }],
          error: null,
        }),
      );
      mockQueryBuilder._response = {
        data: [{ blocked_id: 'blocked-1' }, { blocked_id: 'blocked-2' }],
        error: null,
      };

      const result = await service.getBlockedUserIds('user-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blocks');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('blocked_id');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('blocker_id', 'user-1');
      expect(result).toEqual(['blocked-1', 'blocked-2']);
    });

    it('should return empty array when query returns no data', async () => {
      mockQueryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: null }),
      );
      mockQueryBuilder._response = { data: null, error: null };

      const result = await service.getBlockedUserIds('user-1');
      expect(result).toEqual([]);
    });

    it('should return empty array when query results in error', async () => {
      mockQueryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: { message: 'error' } }),
      );
      mockQueryBuilder._response = { data: null, error: { message: 'error' } };

      const result = await service.getBlockedUserIds('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('getBlockerUserIds', () => {
    it('should return list of blocker user IDs for a user', async () => {
      mockQueryBuilder.then = vi.fn((resolve: any) =>
        resolve({
          data: [{ blocker_id: 'blocker-1' }, { blocker_id: 'blocker-2' }],
          error: null,
        }),
      );
      mockQueryBuilder._response = {
        data: [{ blocker_id: 'blocker-1' }, { blocker_id: 'blocker-2' }],
        error: null,
      };

      const result = await service.getBlockerUserIds('user-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blocks');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('blocker_id');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('blocked_id', 'user-1');
      expect(result).toEqual(['blocker-1', 'blocker-2']);
    });

    it('should return empty array when query returns no data', async () => {
      mockQueryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: null }),
      );
      mockQueryBuilder._response = { data: null, error: null };

      const result = await service.getBlockerUserIds('user-1');
      expect(result).toEqual([]);
    });

    it('should return empty array when query results in error', async () => {
      mockQueryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: { message: 'error' } }),
      );
      mockQueryBuilder._response = { data: null, error: { message: 'error' } };

      const result = await service.getBlockerUserIds('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('getBlockedAndBlockerIds', () => {
    it('should return union of blocked and blocker IDs', async () => {
      // First call: getBlockedUserIds
      mockQueryBuilder.then = vi
        .fn()
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: [{ blocked_id: 'blocked-1' }, { blocked_id: 'blocked-2' }],
            error: null,
          }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: [{ blocker_id: 'blocker-1' }, { blocker_id: 'blocker-2' }],
            error: null,
          }),
        );

      const result = await service.getBlockedAndBlockerIds('user-1');

      expect(result).toHaveLength(4);
      expect(result).toContain('blocked-1');
      expect(result).toContain('blocked-2');
      expect(result).toContain('blocker-1');
      expect(result).toContain('blocker-2');
    });

    it('should deduplicate overlapping IDs', async () => {
      mockQueryBuilder.then = vi
        .fn()
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: [{ blocked_id: 'shared' }, { blocked_id: 'blocked-1' }],
            error: null,
          }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: [{ blocker_id: 'shared' }, { blocker_id: 'blocker-1' }],
            error: null,
          }),
        );

      const result = await service.getBlockedAndBlockerIds('user-1');

      // shared should only appear once
      expect(result.filter((id) => id === 'shared')).toHaveLength(1);
      expect(result).toContain('blocked-1');
      expect(result).toContain('blocker-1');
    });

    it('should fail closed when either direction of the block graph fails', async () => {
      mockQueryBuilder.then = vi
        .fn()
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: [], error: null }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: null, error: { message: 'database unavailable' } }),
        );

      await expect(service.getBlockedAndBlockerIds('user-1')).rejects.toThrow(
        'Failed to load complete block graph',
      );
    });

    it('should fail closed when either block query has an invalid response', async () => {
      mockQueryBuilder.then = vi
        .fn()
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: null, error: null }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: [], error: null }),
        );

      await expect(service.getBlockedAndBlockerIds('user-1')).rejects.toThrow(
        'Failed to load complete block graph',
      );
    });

    it('should fail closed when either block query contains a malformed row', async () => {
      mockQueryBuilder.then = vi
        .fn()
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: [{ blocked_id: 'blocked-1' }, {}], error: null }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: [{ blocker_id: 'blocker-1' }], error: null }),
        );

      await expect(service.getBlockedAndBlockerIds('user-1')).rejects.toThrow(
        'Failed to load complete block graph',
      );
    });

    it.each([
      [{ blocked_id: '' }, { blocker_id: 'blocker-1' }],
      [{ blocked_id: '   ' }, { blocker_id: 'blocker-1' }],
      [{ blocked_id: 'blocked-1' }, { blocker_id: '' }],
      [{ blocked_id: 'blocked-1' }, { blocker_id: ' padded ' }],
    ])(
      'should fail closed for blank or padded block IDs',
      async (blockedRow, blockerRow) => {
        mockQueryBuilder.then = vi
          .fn()
          .mockImplementationOnce((resolve: any) =>
            resolve({ data: [blockedRow], error: null }),
          )
          .mockImplementationOnce((resolve: any) =>
            resolve({ data: [blockerRow], error: null }),
          );

        await expect(service.getBlockedAndBlockerIds('user-1')).rejects.toThrow(
          'Failed to load complete block graph',
        );
      },
    );
  });

  describe('getBlockedUserDetails', () => {
    it('should return empty array when no blocked users', async () => {
      mockQueryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: [], error: null }),
      );
      mockQueryBuilder._response = { data: [], error: null };

      const result = await service.getBlockedUserDetails('user-1');
      expect(result).toEqual([]);
    });

    it('should return blocked user details', async () => {
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
              display_name: 'Blocked One',
              avatar_url: '/avatar1.png',
              native_language: 'en',
              target_languages: ['es'],
            },
            {
              id: 'blocked-2',
              display_name: 'Blocked Two',
              avatar_url: null,
              native_language: 'fr',
              target_languages: ['de', 'it'],
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

      const result = await service.getBlockedUserDetails('user-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'blocked-1',
        display_name: 'Blocked One',
        avatar_url: '/avatar1.png',
        native_language: 'en',
        target_language: 'es',
      });
      expect(result[1]).toEqual({
        id: 'blocked-2',
        display_name: 'Blocked Two',
        avatar_url: null,
        native_language: 'fr',
        target_language: 'de',
      });
    });

    it('should return empty array when user details query fails', async () => {
      const mockBlocksBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn(),
      };
      mockBlocksBuilder.then.mockImplementation((resolve: any) =>
        resolve({
          data: [{ blocked_id: 'blocked-1' }],
          error: null,
        }),
      );

      const mockUsersBuilder = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        then: vi.fn(),
      };
      mockUsersBuilder.then.mockImplementation((resolve: any) =>
        resolve({ data: null, error: { message: 'error' } }),
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'blocks') return mockBlocksBuilder;
        if (table === 'users') return mockUsersBuilder;
        return mockQueryBuilder;
      });

      const result = await service.getBlockedUserDetails('user-1');
      expect(result).toEqual([]);
    });
  });
});

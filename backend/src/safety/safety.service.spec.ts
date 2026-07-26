import { Test, TestingModule } from '@nestjs/testing';
import { SafetyService } from './safety.service';
import { SupabaseService } from '../supabase/supabase.service';
import { Logger } from '@nestjs/common';

describe('SafetyService', () => {
  let service: SafetyService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    mockQueryBuilder = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
      delete: jest.fn().mockReturnThis(),
      then: jest.fn((resolve: any) => resolve(mockQueryBuilder._response)),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SafetyService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<SafetyService>(SafetyService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

      const logSpy = jest
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
      expect(result).toEqual({ id: 'report-id' });
      logSpy.mockRestore();
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
  });

  describe('blockUser', () => {
    it('should block a user successfully', async () => {
      // existing block check returns null
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });
      // insert succeeds
      mockQueryBuilder._response = { error: null };

      const logSpy = jest
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
      logSpy.mockRestore();
    });

    it('should throw when the user is already blocked', async () => {
      // existing block exists
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'existing-block' },
        error: null,
      });

      await expect(
        service.blockUser('user-1', { blocked_id: 'blocked-user' }),
      ).rejects.toThrow('User is already blocked');
    });
  });

  describe('unblockUser', () => {
    it('should unblock a user', async () => {
      mockQueryBuilder._response = { error: null };

      const result = await service.unblockUser('user-1', 'blocked-user');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blocks');
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('blocker_id', 'user-1');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
        'blocked_id',
        'blocked-user',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('getBlockedUserIds', () => {
    it('should return list of blocked user IDs for a user', async () => {
      // Build chain: from('blocks').select('blocked_id').eq('blocker_id', userId)
      mockQueryBuilder.then = jest.fn((resolve: any) =>
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
      mockQueryBuilder.then = jest.fn((resolve: any) =>
        resolve({ data: null, error: null }),
      );
      mockQueryBuilder._response = { data: null, error: null };

      const result = await service.getBlockedUserIds('user-1');
      expect(result).toEqual([]);
    });
  });
});

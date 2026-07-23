import { Test, TestingModule } from '@nestjs/testing';
import { SafetyService } from './safety.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('SafetyService', () => {
  let service: SafetyService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
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
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reportMessage', () => {
    it('should submit safety report successfully and return void', async () => {
      const dto: any = {
        reported_id: 'reported-1',
        reason: 'Spam',
        details: 'Sent unsolicited links',
      };
      const reportRow: any = {
        id: 'report-1',
        reporter_id: 'user-1',
        reported_id: 'bad-user',
        reason: 'spam',
        status: 'pending',
      };

      mockQueryBuilder.single.mockResolvedValueOnce({
        data: reportRow,
        error: null,
      });

      mockQueryBuilder.insert.mockResolvedValue({ error: null });

      const logSpy = jest
        .spyOn((service as any).logger, 'log')
        .mockImplementation(() => {});

      await service.reportMessage('user-1', dto);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('reports');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        reporter_id: 'user-1',
        reported_user_id: 'reported-1',
        reason_category: 'message_content',
        description: 'Spam',
        context_url: null,
        status: 'pending',
      });
      logSpy.mockRestore();
    });

    it('should throw Error when report insertion fails', async () => {
      const dto: any = { reported_id: 'reported-1', reason: 'Spam' };

      mockQueryBuilder.insert.mockResolvedValue({
        error: { message: 'Database error' },
      });

      await expect(service.reportMessage('user-1', dto)).rejects.toThrow(
        'Failed to submit report',
      );
    });
  });

  describe('blockUser', () => {
    it('should insert user block record and return success object', async () => {
      mockQueryBuilder.insert.mockResolvedValueOnce({});
      const logSpy = jest
        .spyOn((service as any).logger, 'log')
        .mockImplementation(() => {});

      const result = await service.blockUser('user-1', {
        blocked_id: 'blocked-user',
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blocks');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        blocker_id: 'user-1',
        blocked_id: 'blocked-user',
      });
      expect(logSpy).toHaveBeenCalledWith('User user-1 blocked blocked-user');
      expect(result).toEqual({ success: true, blocked_id: 'blocked-user' });
      logSpy.mockRestore();
    });
  });

  describe('getBlockedIds', () => {
    it('should return list of blocked user IDs for a user', async () => {
      mockQueryBuilder.eq.mockResolvedValueOnce({
        data: [{ blocked_id: 'blocked-1' }, { blocked_id: 'blocked-2' }],
        error: null,
      });

      const result = await service.getBlockedIds('user-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blocks');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('blocked_id');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('blocker_id', 'user-1');
      expect(result).toEqual(['blocked-1', 'blocked-2']);
    });

    it('should return empty array when query returns no data or null', async () => {
      mockQueryBuilder.eq.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await service.getBlockedIds('user-1');
      expect(result).toEqual([]);
    });
  });
});

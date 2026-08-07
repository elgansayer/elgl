import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('ModerationService', () => {
  let service: ModerationService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      limit: jest.fn(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
      then: jest.fn((resolve: any) => resolve(mockQueryBuilder._response)),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<ModerationService>(ModerationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reportUser', () => {
    it('should insert a report and return data', async () => {
      mockQueryBuilder._response = { data: { id: 'report-1' }, error: null };

      const dto = {
        reportedUserId: 'bad-user',
        reasonCategory: 'harassment',
        description: 'Being abusive',
      };

      const result = await service.reportUser('reporter-1', dto);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('reports');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        reporter_id: 'reporter-1',
        reported_user_id: 'bad-user',
        reason_category: 'harassment',
        description: 'Being abusive',
        status: 'pending',
      });
      expect(result).toEqual({ id: 'report-1' });
    });

    it('should insert a report without description when description is undefined', async () => {
      mockQueryBuilder._response = { data: { id: 'report-2' }, error: null };

      const dto = { reportedUserId: 'bad-user', reasonCategory: 'spam' };
      await service.reportUser('reporter-1', dto);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        reporter_id: 'reporter-1',
        reported_user_id: 'bad-user',
        reason_category: 'spam',
        description: null,
        status: 'pending',
      });
    });

    it('should throw NotFoundException when insert fails', async () => {
      mockQueryBuilder._response = {
        data: null,
        error: { message: 'db error' },
      };

      await expect(
        service.reportUser('reporter-1', {
          reportedUserId: 'bad-user',
          reasonCategory: 'spam',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('approveItem', () => {
    it('should update report status to approved', async () => {
      mockQueryBuilder._response = { error: null };

      const result = await service.approveItem({
        itemId: 'report-1',
        type: 'profile',
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('reports');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        status: 'approved',
      });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'report-1');
      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException when update fails', async () => {
      mockQueryBuilder._response = { error: { message: 'db error' } };

      await expect(
        service.approveItem({ itemId: 'report-1', type: 'profile' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('rejectItem', () => {
    it('should update report status to rejected with reason', async () => {
      mockQueryBuilder._response = { error: null };

      const result = await service.rejectItem({
        itemId: 'report-1',
        type: 'moment',
        reason: 'violation',
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('reports');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        status: 'rejected',
        reason_category: 'violation',
      });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'report-1');
      expect(result).toEqual({ success: true });
    });

    it('should reject without reason when reason is undefined', async () => {
      mockQueryBuilder._response = { error: null };

      await service.rejectItem({ itemId: 'report-2', type: 'profile' });

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        status: 'rejected',
        reason_category: undefined,
      });
    });

    it('should throw NotFoundException when update fails', async () => {
      mockQueryBuilder._response = { error: { message: 'db error' } };

      await expect(
        service.rejectItem({ itemId: 'report-1', type: 'profile' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getItems', () => {
    it('should fetch and map moderation items for profile type', async () => {
      const row = {
        id: 'report-1',
        status: 'pending',
        reason_category: 'harassment',
        created_at: '2026-01-01',
        reporter_id: 'rep-1',
        reported_user_id: 'bad-1',
        reported_moment_id: null,
        description: 'Bad behaviour',
        reporter: { id: 'rep-1', display_name: 'Reporter' },
        reported_user: { id: 'bad-1', display_name: 'Bad User' },
      };

      mockQueryBuilder._response = { data: [row], count: 1, error: null };

      const result = await service.getItems({ type: 'profile' });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('reports');
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0]).toMatchObject({
        id: 'report-1',
        status: 'pending',
        reason: 'harassment',
        description: 'Bad behaviour',
        reportedMomentId: null,
      });
      expect(result.items[0].reporter).toEqual({
        id: 'rep-1',
        display_name: 'Reporter',
      });
      expect(result.items[0].reported_user).toEqual({
        id: 'bad-1',
        display_name: 'Bad User',
      });
    });

    it('should filter by status when status is provided', async () => {
      mockQueryBuilder._response = { data: [], count: 0, error: null };

      await service.getItems({ type: 'profile', status: 'pending' });

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('status', 'pending');
    });

    it('should throw NotFoundException when query errors', async () => {
      mockQueryBuilder._response = { error: { message: 'fail' } };

      await expect(
        service.getItems({ type: 'profile' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return empty items when data is null', async () => {
      mockQueryBuilder._response = { data: null, count: 0, error: null };

      const result = await service.getItems({ type: 'profile' });
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should batch-hydrate moment reports with moment content', async () => {
      const reportRow = {
        id: 'report-2',
        status: 'pending',
        reason_category: 'spam',
        created_at: '2026-01-01',
        reporter_id: 'rep-1',
        reported_user_id: null,
        reported_moment_id: 'moment-1',
        description: null,
        reporter: null,
        reported_user: null,
      };

      mockQueryBuilder._response = { data: [reportRow], count: 1, error: null };

      const momentBuilder = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'moment-1',
              content_text: 'Hello world',
              author: { display_name: 'Moment Author' },
            },
          ],
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'moments') return momentBuilder;
        return mockQueryBuilder;
      });

      const result = await service.getItems({ type: 'moment' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: 'report-2',
        moment_content: 'Hello world',
        momentAuthorName: 'Moment Author',
      });
    });
  });

  describe('analyseUserForDatingBehaviour', () => {
    const mockUser = {
      display_name: 'John',
      bio_text: 'I enjoy learning languages and hiking',
      native_language: 'en',
      target_languages: ['es', 'fr'],
      status_text: '',
      greeting_message: '',
      away_message: '',
    };

    it('should return low risk score for clean profile', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: mockUser,
        error: null,
      });

      mockQueryBuilder.limit.mockResolvedValueOnce({ data: [], error: null });

      const result = await service.analyseUserForDatingBehaviour('user-1');

      expect(result.riskScore).toBe(0);
      expect(result.flags).toHaveLength(0);
    });

    it('should detect dating keywords and return high risk score', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          ...mockUser,
          bio_text: 'Looking for a man to date me, kiss me and love me forever',
          status_text: 'single and ready to mingle',
        },
        error: null,
      });

      mockQueryBuilder.limit.mockResolvedValueOnce({
        data: [
          { content_text: 'I want to find a boyfriend and get married' },
          { content_text: 'Looking for romance and dating' },
        ],
        error: null,
      });

      const result = await service.analyseUserForDatingBehaviour('user-1');

      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.flags.length).toBeGreaterThan(0);
    });

    it('should throw NotFoundException when user is not found', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'not found' },
      });

      await expect(
        service.analyseUserForDatingBehaviour('missing-user'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle empty moments gracefully', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { ...mockUser, bio_text: '' },
        error: null,
      });

      mockQueryBuilder.limit.mockResolvedValueOnce({ data: null, error: null });

      const result = await service.analyseUserForDatingBehaviour('user-1');
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });

    it('should return a high risk score with many flags (near cap)', async () => {
      // Use large number of dating keywords to approach cap
      const datingText =
        'dating date relationship boyfriend girlfriend love marry marriage romance romantic sex hookup flirt hot sexy single looking for a man date me kiss kissing partner fwb friends with benefits casual sex hook up one night meet up meetup hang out dinner coffee romantic romantically sexting horny daddy mommy';
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          ...mockUser,
          bio_text: datingText,
          status_text: 'looking for a woman to marry me',
        },
        error: null,
      });

      mockQueryBuilder.limit.mockResolvedValueOnce({ data: [], error: null });

      const result = await service.analyseUserForDatingBehaviour('user-1');
      // With many flags the riskScore should be very high (near or at cap)
      expect(result.riskScore).toBeGreaterThanOrEqual(95);
      expect(result.flags.length).toBeGreaterThan(10);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ModerationService } from './moderation.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from '../metrics/metrics.service';
import { SafetyService } from '../safety/safety.service';
import { PinoLogger } from 'nestjs-pino';

const mockPinoLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

describe('ModerationService', () => {
  let service: ModerationService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;
  let mockMetricsService: any;
  let mockSafetyService: { reportUser: ReturnType<typeof vi.fn> };
  let mockLogger: any;

  beforeEach(async () => {
    mockLogger = {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };

    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      limit: vi.fn(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
      then: vi.fn((resolve: any) => resolve(mockQueryBuilder._response)),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    mockMetricsService = {
      recordTsReportSubmitted: vi.fn(),
      recordTsModerationAction: vi.fn(),
      recordTsDatingRiskScore: vi.fn(),
      setTsPendingReports: vi.fn(),
      recordAdminReportResolution: vi.fn(),
    };

    mockSafetyService = { reportUser: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        {
          provide: SafetyService,
          useValue: mockSafetyService,
        },
        {
          provide: 'PinoLogger:ModerationService',
          useValue: mockPinoLogger,
        },
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
          provide: `PinoLogger:${ModerationService.name}`,
          useValue: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
            trace: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ModerationService>(ModerationService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reportUser', () => {
    const TARGET = '22222222-2222-4222-8222-222222222222';

    it('files the report through the shared safety boundary', async () => {
      mockSafetyService.reportUser.mockResolvedValue({
        id: 'report-1',
        duplicate: false,
      });

      const result = await service.reportUser('reporter-1', {
        reportedUserId: TARGET,
        reasonCategory: 'harassment',
        description: 'Being abusive',
      });

      expect(mockSafetyService.reportUser).toHaveBeenCalledWith('reporter-1', {
        reported_id: TARGET,
        reason_category: 'harassment',
        description: 'Being abusive',
      });
      expect(result).toEqual({
        success: true,
        report_id: 'report-1',
        duplicate: false,
      });
    });

    it('does not write to the reports table itself', async () => {
      mockSafetyService.reportUser.mockResolvedValue({
        id: 'report-1',
        duplicate: false,
      });

      await service.reportUser('reporter-1', {
        reportedUserId: TARGET,
        reasonCategory: 'spam',
      });

      expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
      expect(mockMetricsService.recordTsReportSubmitted).not.toHaveBeenCalled();
    });

    it('returns the existing open report for a repeat submission', async () => {
      mockSafetyService.reportUser.mockResolvedValue({
        id: 'report-1',
        duplicate: true,
      });

      await expect(
        service.reportUser('reporter-1', {
          reportedUserId: TARGET,
          reasonCategory: 'spam',
        }),
      ).resolves.toEqual({
        success: true,
        report_id: 'report-1',
        duplicate: true,
      });
    });

    it('propagates validation and persistence failures instead of returning success false', async () => {
      const failure = new Error('Unable to submit report');
      mockSafetyService.reportUser.mockRejectedValue(failure);

      await expect(
        service.reportUser('reporter-1', {
          reportedUserId: TARGET,
          reasonCategory: 'spam',
        }),
      ).rejects.toBe(failure);
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

    it('should return degraded response when update fails', async () => {
      mockQueryBuilder._response = { error: { message: 'db error' } };

      const result = await service.approveItem({
        itemId: 'report-1',
        type: 'profile',
      });

      expect(result).toEqual({
        success: false,
        error: 'Failed to approve item',
      });
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

    it('should return degraded response when update fails', async () => {
      mockQueryBuilder._response = { error: { message: 'db error' } };

      const result = await service.rejectItem({
        itemId: 'report-1',
        type: 'profile',
      });

      expect(result).toEqual({
        success: false,
        error: 'Failed to reject item',
      });
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

      mockQueryBuilder._response = { data: [row], error: null };

      const result = await service.getItems('profile');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('reports');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'report-1',
        status: 'pending',
        reason: 'harassment',
        description: 'Bad behaviour',
        reportedMomentId: null,
      });
      expect(result[0].reporter).toEqual({
        id: 'rep-1',
        display_name: 'Reporter',
      });
      expect(result[0].reported_user).toEqual({
        id: 'bad-1',
        display_name: 'Bad User',
      });
    });

    it('should filter by status when status is provided', async () => {
      mockQueryBuilder._response = { data: [], error: null };

      await service.getItems('profile', 'pending');

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('status', 'pending');
    });

    it('should return empty array when query errors (graceful degradation)', async () => {
      mockQueryBuilder._response = { error: { message: 'fail' } };

      const result = await service.getItems('profile');

      expect(result).toEqual([]);
    });

    it('should return empty array when data is null', async () => {
      mockQueryBuilder._response = { data: null, error: null };

      const result = await service.getItems('profile');
      expect(result).toEqual([]);
    });

    it('should hydrate moment reports with moment content - batch fetch', async () => {
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

      mockQueryBuilder._response = { data: [reportRow], error: null };

      const momentBuilder = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        then: vi.fn((resolve: any) =>
          resolve({
            data: [
              {
                id: 'moment-1',
                content_text: 'Hello world',
                author: { display_name: 'Moment Author' },
              },
            ],
            error: null,
          }),
        ),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'moments') return momentBuilder;
        return mockQueryBuilder;
      });

      const result = await service.getItems('moment');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'report-2',
        moment_content: 'Hello world',
        momentAuthorName: 'Moment Author',
      });
    });

    it('should handle missing moment content gracefully - batch fetch', async () => {
      const reportRow = {
        id: 'report-3',
        status: 'pending',
        reason_category: 'spam',
        created_at: '2026-01-01',
        reporter_id: 'rep-1',
        reported_user_id: null,
        reported_moment_id: 'moment-missing',
        description: null,
        reporter: null,
        reported_user: null,
      };

      mockQueryBuilder._response = { data: [reportRow], error: null };

      const momentBuilder = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        then: vi.fn((resolve: any) =>
          resolve({ data: null, error: { message: 'not found' } }),
        ),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'moments') return momentBuilder;
        return mockQueryBuilder;
      });

      const result = await service.getItems('moment');
      // Moment with missing content is still returned (the item itself is valid)
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('report-3');
      expect(result[0].moment_content).toBeUndefined();
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

    it('should return zero risk score when user is not found (graceful degradation)', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'not found' },
      });

      const result =
        await service.analyseUserForDatingBehaviour('missing-user');

      expect(result).toEqual({ riskScore: 0, flags: [] });
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

    it('should cap riskScore at 100 with many flags', async () => {
      // Use large number of dating keywords to approach cap
      const datingText =
        'dating date relationship boyfriend girlfriend love marry marriage romance romantic sex hookup flirt hot sexy single looking for a man date me kiss kissing partner fwb friends with benefits casual sex hook up one night meet up meetup hang out dinner coffee romantic romantically sexting horny daddy mommy hot sexy';
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
      // With many flags the riskScore should be capped at 100
      expect(result.riskScore).toBe(100);
      expect(result.flags.length).toBeGreaterThan(10);
    });
  });
});

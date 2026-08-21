import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ProfileVisitsService } from './profile-visits.service';
import { SupabaseService } from '../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ProfileVisitsService', () => {
  let service: ProfileVisitsService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;
  let mockNotificationsService: { sendVisitNotification: Mock };
  let mockEventEmitter: { emit: Mock };

  beforeEach(async () => {
    mockQueryBuilder = {
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    mockNotificationsService = {
      sendVisitNotification: vi.fn(),
    };

    mockEventEmitter = {
      emit: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileVisitsService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<ProfileVisitsService>(ProfileVisitsService);
  });

  describe('getVisitCount', () => {
    it('should return the correct visit count for a user', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { visit_count: 5 },
        error: null,
      });

      const result = await service.getVisitCount('user-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profile_visits');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith(
        'count(*) as visit_count',
      );
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('viewed_id', 'user-1');
      expect(result).toEqual(5);
    });

    it('should return 0 if no visits are found', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await service.getVisitCount('user-1');

      expect(result).toEqual(0);
    });

    it('should throw an error if the query fails', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB query error' },
      });

      await expect(service.getVisitCount('user-1')).rejects.toThrow(
        'Failed to fetch visit count: DB query error',
      );
    });
  });

  describe('deleteVisit', () => {
    it('should delete a visit record successfully', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'visit-1' },
        error: null,
      });

      const result = await service.deleteVisit('visit-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profile_visits');
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'visit-1');
      expect(result).toEqual({ id: 'visit-1' });
    });

    it('should throw an error if the delete operation fails', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Delete operation failed' },
      });

      await expect(service.deleteVisit('visit-1')).rejects.toThrow(
        'Failed to delete visit: Delete operation failed',
      );

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profile_visits');
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'visit-1');
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordVisit', () => {
    it('should ignore visit when visitor views their own profile', async () => {
      const result = await service.recordVisit('user-1', 'user-1', false);
      expect(result).toEqual({ ignored: true });
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('should ignore visit when VIP visitor has incognito mode (incognito_visits) enabled', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { incognito_visits: true },
        error: null,
      });

      const result = await service.recordVisit('vip-user', 'target-user', true);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('incognito_visits');
      expect(result).toEqual({ incognito: true, ignored: true });
      // No insert should be attempted, and no notification should be emitted
      expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
      expect(
        mockNotificationsService.sendVisitNotification,
      ).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should record visit for VIP visitor when incognito mode is disabled', async () => {
      // 1st single call: user lookup for privacy setting
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { incognito_visits: false },
        error: null,
      });
      // 2nd single call: profile_visits insert
      const visitRow = {
        id: 'visit-1',
        visitor_id: 'vip-user',
        viewed_id: 'target-user',
      };
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: visitRow,
        error: null,
      });

      const result = await service.recordVisit('vip-user', 'target-user', true);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profile_visits');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        visitor_id: 'vip-user',
        viewed_id: 'target-user',
      });
      expect(result).toEqual(visitRow);
    });

    it('should record visit for regular non-VIP visitor without checking privacy setting', async () => {
      const visitRow = {
        id: 'visit-2',
        visitor_id: 'free-user',
        viewed_id: 'target-user',
      };
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: visitRow,
        error: null,
      });

      const result = await service.recordVisit(
        'free-user',
        'target-user',
        false,
      );

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profile_visits');
      expect(result).toEqual(visitRow);
    });

    it('should throw Error when insert visit fails for VIP visitor', async () => {
      // First call checks privacy setting
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { incognito_visits: false },
        error: null,
      });
      // Second call fails to insert
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Insert constraint violation' },
      });

      await expect(
        service.recordVisit('vip-user', 'target-user', true),
      ).rejects.toThrow('Failed to record visit: Insert constraint violation');
    });

    it('should throw Error when insert visit fails for non VIP visitor', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Insert constraint violation' },
      });

      await expect(
        service.recordVisit('free-user', 'target-user', false),
      ).rejects.toThrow('Failed to record visit: Insert constraint violation');
    });
  });

  describe('getVisitors', () => {
    it('should return unblurred visitor records when profile owner is VIP', async () => {
      const rows = [
        {
          id: 'v-1',
          created_at: '2026-07-22T10:00:00Z',
          visitor: {
            id: 'visitor-1',
            display_name: 'John',
            avatar_url: 'avatar.png',
            native_language: 'en',
            target_languages: ['fr'],
          },
        },
      ];
      mockQueryBuilder.limit.mockResolvedValue({
        data: rows,
        error: null,
      });

      const result = await service.getVisitors('owner-1', true);

      expect(result).toEqual([
        {
          id: 'v-1',
          created_at: '2026-07-22T10:00:00Z',
          is_blurred: false,
          visitor: {
            id: 'visitor-1',
            display_name: 'John',
            avatar_url: 'avatar.png',
            native_language: 'en',
            target_languages: ['fr'],
          },
        },
      ]);
    });

    it('should return blurred visitor records when profile owner is not VIP', async () => {
      const rows = [
        {
          id: 'v-2',
          created_at: '2026-07-22T11:00:00Z',
          visitor: {
            id: 'visitor-2',
            display_name: 'Secret User',
            avatar_url: 'secret.png',
            native_language: 'ja',
            target_languages: ['en'],
          },
        },
      ];
      mockQueryBuilder.limit.mockResolvedValue({
        data: rows,
        error: null,
      });

      const result = await service.getVisitors('owner-free', false);

      expect(result).toEqual([
        {
          id: 'v-2',
          created_at: '2026-07-22T11:00:00Z',
          is_blurred: true,
          visitor: {
            id: 'hidden-vip-only',
            display_name: 'Someone near you',
            avatar_url: null,
            native_language: 'ja',
            target_languages: ['en'],
          },
        },
      ]);
    });

    it('should use default native_language and target_languages if visitor fields are null or undefined when blurring', async () => {
      const rows = [
        {
          id: 'v-3',
          created_at: '2026-07-22T12:00:00Z',
          visitor: null,
        },
      ];
      mockQueryBuilder.limit.mockResolvedValue({
        data: rows,
        error: null,
      });

      const result = await service.getVisitors('owner-free', false);

      expect(result[0].visitor.native_language).toBe('en');
      expect(result[0].visitor.target_languages).toEqual(['es']);
    });

    it('should return empty array when query returns error or null data', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: null,
        error: { message: 'DB query error' },
      });

      const result = await service.getVisitors('owner-1', true);
      expect(result).toEqual([]);
    });
  });
});

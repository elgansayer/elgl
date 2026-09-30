import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      // Make the builder thenable so awaiting the chain resolves correctly
      then: vi.fn().mockImplementation((resolve: (value: any) => void) => {
        resolve({ data: [], error: null });
        return Promise.resolve({ data: [], error: null });
      }),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockReturnValue(null),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendPushNotification', () => {
    const defaultPreferences = {
      userId: 'user-1',
      direct_messages: { push: true, badge: true },
      groups: { push: true, badge: true },
      likes: { push: true, badge: true },
      voice_rooms: { push: true, badge: true },
      do_not_disturb: false,
      updatedAt: '2026-08-23T10:00:00.000Z',
    };

    it('returns suppressed when the user has intentionally disabled the category', async () => {
      vi.spyOn(service, 'getPreferences').mockResolvedValue({
        ...defaultPreferences,
        groups: { push: false, badge: true },
      });

      const result = await service.sendPushNotification('user-1', {
        type: 'event_reminder',
        title: 'Event Reminder',
        body: 'Starts soon',
        category: 'groups',
      });

      expect(result).toBe('suppressed');
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('returns suppressed when there are no registered push tokens', async () => {
      vi.spyOn(service, 'getPreferences').mockResolvedValue(defaultPreferences);

      const result = await service.sendPushNotification('user-1', {
        type: 'event_reminder',
        title: 'Event Reminder',
        body: 'Starts soon',
        category: 'groups',
      });

      expect(result).toBe('suppressed');
    });

    it('returns retry when the push-token lookup fails', async () => {
      vi.spyOn(service, 'getPreferences').mockResolvedValue(defaultPreferences);
      mockQueryBuilder.then.mockImplementationOnce(
        (resolve: (value: any) => void) => {
          resolve({ data: null, error: { message: 'temporary failure' } });
          return Promise.resolve({
            data: null,
            error: { message: 'temporary failure' },
          });
        },
      );

      const result = await service.sendPushNotification('user-1', {
        type: 'event_reminder',
        title: 'Event Reminder',
        body: 'Starts soon',
        category: 'groups',
      });

      expect(result).toBe('retry');
    });
  });

  describe('createNotification', () => {
    it('should insert notification into Supabase when recipient is not actor', async () => {
      await service.createNotification('recipient-1', 'actor-1', 'follow');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('notifications');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient_id: 'recipient-1',
          actor_id: 'actor-1',
          type: 'follow',
          is_read: false,
        }),
      );
    });

    it('should ignore when recipient is the same as actor', async () => {
      await service.createNotification('user-1', 'user-1', 'follow');
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });
  });

  describe('getNotifications', () => {
    it('should return mock notifications when database is empty', async () => {
      const results = await service.getNotifications('user-1');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].recipient_id).toBe('user-1');
    });

    it('should filter mock notifications by type likes', async () => {
      const results = await service.getNotifications('user-1', 'likes');
      expect(
        results.every(
          (n) => n.type === 'like_profile' || n.type === 'like_moment',
        ),
      ).toBe(true);
    });
  });

  describe('markAsRead & markAllAsRead', () => {
    it('should mark single notification as read', async () => {
      await service.markAsRead('user-1', 'notif-1');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('notifications');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({ is_read: true });
    });

    it('should mark all notifications as read', async () => {
      await service.markAllAsRead('user-1');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('notifications');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({ is_read: true });
    });
  });
});

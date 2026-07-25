import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      // Make the builder thenable so awaiting the chain resolves correctly
      then: jest
        .fn()
        .mockImplementation((resolve: (value: any) => void) => {
          resolve({ data: [], error: null });
          return Promise.resolve({ data: [], error: null });
        }),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(null),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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

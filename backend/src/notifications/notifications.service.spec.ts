import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import { SupabaseService } from '../supabase/supabase.service';
import { I18nService } from '../i18n/i18n.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;
  const emit = vi.fn();

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    emit.mockClear();

    mockQueryBuilder = {
      single: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
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
        { provide: EventEmitter2, useValue: { emit } },
        I18nService,
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
      await service.createNotification(
        'recipient-1',
        'actor-1',
        'follow',
        undefined,
        undefined,
        false,
      );

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('notifications');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient_id: 'recipient-1',
          actor_id: 'actor-1',
          type: 'follow',
          is_read: false,
        }),
      );
      expect(emit).toHaveBeenCalledWith(
        'unread.counts_changed',
        expect.objectContaining({
          recipientId: 'recipient-1',
          source: 'notifications',
        }),
      );
    });

    it('pushes copy in the recipient locale', async () => {
      const push = vi.spyOn(service, 'sendPushNotification');
      vi.spyOn(service['i18nService'], 'resolveUserLocale').mockResolvedValue(
        'es',
      );

      await service.createNotification('recipient-1', 'actor-1', 'follow');

      expect(push).toHaveBeenCalledWith(
        'recipient-1',
        expect.objectContaining({
          type: 'follow',
          title: 'Nuevo seguidor',
          body: 'Alguien empezó a seguirte',
        }),
      );
    });

    it('does not double-invalidate the notification tabs for a mirrored chat row', async () => {
      await service.createNotification(
        'recipient-1',
        'actor-1',
        'mention_chat',
        undefined,
        undefined,
        false,
      );

      expect(emit).not.toHaveBeenCalled();
    });

    it('does not emit unread invalidation when persistence fails', async () => {
      mockQueryBuilder.insert.mockResolvedValueOnce({
        error: { message: 'unavailable' },
      });

      await service.createNotification(
        'recipient-1',
        'actor-1',
        'follow',
        undefined,
        undefined,
        false,
      );

      expect(emit).not.toHaveBeenCalled();
    });

    it('should ignore when recipient is the same as actor', async () => {
      await service.createNotification('user-1', 'user-1', 'follow');
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });
  });

  describe('system alerts', () => {
    it('persists a system alert against the recipient and bypasses the self-action guard', async () => {
      await service.createNotification(
        'user-1',
        'user-1',
        'system',
        'entity-1',
        'Your plan was updated',
        false,
      );

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient_id: 'user-1',
          actor_id: 'user-1',
          type: 'system',
          entity_id: 'entity-1',
          message: 'Your plan was updated',
          is_read: false,
        }),
      );
      expect(emit).toHaveBeenCalledWith(
        'unread.counts_changed',
        expect.objectContaining({
          recipientId: 'user-1',
          source: 'notifications',
        }),
      );
    });

    it('never attributes a system alert to a producer-supplied user', async () => {
      await service.createNotification(
        'user-1',
        'some-admin',
        'system',
        undefined,
        'Hello',
        false,
      );

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ actor_id: 'user-1' }),
      );
    });

    it('pushes the alert text without an actor identifier', async () => {
      const push = vi.spyOn(service, 'sendPushNotification');

      await service.createNotification(
        'user-1',
        'user-1',
        'system',
        undefined,
        'Your plan was updated',
      );

      expect(push).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          type: 'system',
          title: 'System Alert',
          body: 'Your plan was updated',
          data: { actorId: '', entityId: '' },
        }),
      );
    });

    it('still rejects self-actions for social notification types', async () => {
      await service.createNotification('user-1', 'user-1', 'like_moment');

      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });
  });

  describe('hasNotification', () => {
    it('reports an existing notification for the same actor, type and entity', async () => {
      mockQueryBuilder.limit.mockResolvedValueOnce({
        data: [{ id: 'notification-1' }],
        error: null,
      });

      await expect(
        service.hasNotification('recipient-1', 'actor-1', 'like_moment', 'm-1'),
      ).resolves.toBe(true);

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
        'recipient_id',
        'recipient-1',
      );
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('actor_id', 'actor-1');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('type', 'like_moment');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('entity_id', 'm-1');
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(1);
    });

    it('matches entity-less notifications with an explicit null check', async () => {
      await expect(
        service.hasNotification('recipient-1', 'actor-1', 'like_profile'),
      ).resolves.toBe(false);

      expect(mockQueryBuilder.is).toHaveBeenCalledWith('entity_id', null);
    });

    it('fails open when the lookup returns an error', async () => {
      mockQueryBuilder.limit.mockResolvedValueOnce({
        data: null,
        error: { message: 'unavailable' },
      });

      await expect(
        service.hasNotification('recipient-1', 'actor-1', 'like_moment', 'm-1'),
      ).resolves.toBe(false);
    });

    it('fails open when the lookup throws', async () => {
      mockQueryBuilder.limit.mockRejectedValueOnce(new Error('network down'));

      await expect(
        service.hasNotification('recipient-1', 'actor-1', 'like_moment', 'm-1'),
      ).resolves.toBe(false);
    });
  });
});

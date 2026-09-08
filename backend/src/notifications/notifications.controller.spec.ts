import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { User } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { NotificationsController } from './notifications.controller';
import { NotificationsInboxService } from './notifications-inbox.service';
import {
  type LegacyNotificationPreferences,
  NotificationsService,
} from './notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationsService: {
    getPreferences: ReturnType<typeof vi.fn>;
    updatePreferences: ReturnType<typeof vi.fn>;
  };
  let inboxService: {
    getNotifications: ReturnType<typeof vi.fn>;
    getUnreadCount: ReturnType<typeof vi.fn>;
    markAsRead: ReturnType<typeof vi.fn>;
    markAllAsRead: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    notificationsService = {
      getPreferences: vi.fn(),
      updatePreferences: vi.fn(),
    };
    inboxService = {
      getNotifications: vi.fn().mockResolvedValue([{ id: 'notif-1' }]),
      getUnreadCount: vi.fn().mockResolvedValue({ unreadCount: 3 }),
      markAsRead: vi.fn().mockResolvedValue(undefined),
      markAllAsRead: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: notificationsService },
        { provide: NotificationsInboxService, useValue: inboxService },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('gets a bounded page for the authenticated user', async () => {
    const user = { id: 'user-1' } as unknown as User;
    const query = {
      type: 'likes' as const,
      limit: 20,
      before: '2026-08-25T12:00:00.000Z',
    };

    await expect(controller.getNotifications(user, query)).resolves.toEqual([
      { id: 'notif-1' },
    ]);
    expect(inboxService.getNotifications).toHaveBeenCalledWith('user-1', query);
  });

  it('gets the authenticated user unread count', async () => {
    const user = { id: 'user-1' } as unknown as User;
    await expect(controller.getUnreadCount(user)).resolves.toEqual({
      unreadCount: 3,
    });
    expect(inboxService.getUnreadCount).toHaveBeenCalledWith('user-1');
  });

  it('marks a single notification as read for the authenticated user', async () => {
    const user = { id: 'user-1' } as unknown as User;
    const id = 'd0aa8e62-d334-4d0f-8450-ecb998ed3bf5';
    await expect(controller.markAsRead(id, user)).resolves.toEqual({
      success: true,
    });
    expect(inboxService.markAsRead).toHaveBeenCalledWith('user-1', id);
  });

  it('marks all notifications as read for the authenticated user', async () => {
    const user = { id: 'user-1' } as unknown as User;
    await expect(controller.markAllAsRead(user)).resolves.toEqual({
      success: true,
    });
    expect(inboxService.markAllAsRead).toHaveBeenCalledWith('user-1');
  });

  describe('notification settings', () => {
    const user = {
      id: '11111111-1111-4111-8111-111111111111',
    } as unknown as User;
    const current: LegacyNotificationPreferences = {
      userId: user.id,
      direct_messages: { push: true, badge: false },
      groups: { push: false, badge: true },
      likes: { push: true, badge: true },
      voice_rooms: { push: false, badge: false },
      do_not_disturb: true,
      updatedAt: '2026-08-27T07:00:00.000Z',
    };

    it('rejects preference mutations without an authenticated user', async () => {
      await expect(
        controller.updatePreferences(null, {
          direct_messages: { push: false },
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(notificationsService.getPreferences).not.toHaveBeenCalled();
      expect(notificationsService.updatePreferences).not.toHaveBeenCalled();
    });

    it('preserves untouched categories when one push toggle changes', async () => {
      const updated: LegacyNotificationPreferences = {
        ...current,
        direct_messages: { push: false, badge: false },
        updatedAt: '2026-08-27T07:01:00.000Z',
      };
      notificationsService.getPreferences
        .mockResolvedValueOnce(current)
        .mockResolvedValueOnce(updated);
      notificationsService.updatePreferences.mockResolvedValue(undefined);

      const result = await controller.updatePreferences(user, {
        direct_messages: { push: false },
      });

      expect(notificationsService.updatePreferences).toHaveBeenCalledWith(user.id, {
        direct_messages: { push: false, badge: false },
        groups: current.groups,
        likes: current.likes,
        voice_rooms: current.voice_rooms,
        do_not_disturb: true,
      });
      expect(result).toEqual({ success: true, preferences: updated });
    });

    it('preserves the category push value when only its badge toggle changes', async () => {
      const updated: LegacyNotificationPreferences = {
        ...current,
        groups: { push: false, badge: false },
      };
      notificationsService.getPreferences
        .mockResolvedValueOnce(current)
        .mockResolvedValueOnce(updated);
      notificationsService.updatePreferences.mockResolvedValue(undefined);

      await controller.updatePreferences(user, {
        groups: { badge: false },
      });

      expect(notificationsService.updatePreferences).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({
          groups: { push: false, badge: false },
          direct_messages: current.direct_messages,
          likes: current.likes,
          voice_rooms: current.voice_rooms,
        }),
      );
    });

    it('does not write when the authoritative preference read fails', async () => {
      notificationsService.getPreferences.mockRejectedValue(new Error('database unavailable'));

      await expect(
        controller.updatePreferences(user, {
          likes: { push: false },
        }),
      ).rejects.toThrow('database unavailable');

      expect(notificationsService.updatePreferences).not.toHaveBeenCalled();
    });
  });
});

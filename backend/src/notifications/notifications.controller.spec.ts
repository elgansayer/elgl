import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { User } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { NotificationsController } from './notifications.controller';
import { NotificationsInboxService } from './notifications-inbox.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let inboxService: {
    getNotifications: ReturnType<typeof vi.fn>;
    getUnreadCount: ReturnType<typeof vi.fn>;
    markAsRead: ReturnType<typeof vi.fn>;
    markAllAsRead: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    inboxService = {
      getNotifications: vi.fn().mockResolvedValue([{ id: 'notif-1' }]),
      getUnreadCount: vi.fn().mockResolvedValue({
        unreadCount: 3,
        byTab: { moments: 1, discovery: 1, profile: 1 },
      }),
      markAsRead: vi.fn().mockResolvedValue(undefined),
      markAllAsRead: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
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
      byTab: { moments: 1, discovery: 1, profile: 1 },
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
});

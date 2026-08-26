import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: {
            getNotifications: vi.fn().mockResolvedValue([{ id: 'notif-1' }]),
            getUnreadCount: vi.fn().mockResolvedValue({ unreadCount: 3 }),
            markAsRead: vi.fn().mockResolvedValue(undefined),
            markAllAsRead: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get notifications for authenticated user', async () => {
    const mockUser = { id: 'user-1' } as any;
    const result = await controller.getNotifications(mockUser, 'all');
    expect(service.getNotifications).toHaveBeenCalledWith('user-1', 'all');
    expect(result).toEqual([{ id: 'notif-1' }]);
  });

  it('should get unread count for authenticated user', async () => {
    const mockUser = { id: 'user-1' } as any;
    const result = await controller.getUnreadCount(mockUser);
    expect(service.getUnreadCount).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ unreadCount: 3 });
  });

  it('should mark single notification as read', async () => {
    const mockUser = { id: 'user-1' } as any;
    const result = await controller.markAsRead('notif-1', mockUser);
    expect(service.markAsRead).toHaveBeenCalledWith('user-1', 'notif-1');
    expect(result).toEqual({ success: true });
  });

  it('should mark all notifications as read', async () => {
    const mockUser = { id: 'user-1' } as any;
    const result = await controller.markAllAsRead(mockUser);
    expect(service.markAllAsRead).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ success: true });
  });
});

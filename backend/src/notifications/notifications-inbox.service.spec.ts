import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SupabaseService } from '../supabase/supabase.service';
import { NotificationsInboxService } from './notifications-inbox.service';

describe('NotificationsInboxService', () => {
  let service: NotificationsInboxService;
  let builder: any;
  let client: any;
  let result: { data: unknown; error: unknown; count?: number };

  beforeEach(async () => {
    result = { data: [], error: null, count: 0 };
    builder = {
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => Promise.resolve(result)),
      then: vi
        .fn()
        .mockImplementation((resolve: (value: unknown) => unknown) =>
          Promise.resolve(resolve(result)),
        ),
    };
    client = { from: vi.fn().mockReturnValue(builder) };

    const module = await Test.createTestingModule({
      providers: [
        NotificationsInboxService,
        {
          provide: SupabaseService,
          useValue: { getClient: vi.fn().mockReturnValue(client) },
        },
      ],
    }).compile();

    service = module.get(NotificationsInboxService);
  });

  it('returns an empty inbox without fabricating notifications', async () => {
    await expect(service.getNotifications('user-1')).resolves.toEqual([]);
    expect(builder.limit).toHaveBeenCalledWith(20);
  });

  it('applies bounded filters and a pagination cursor', async () => {
    const before = '2026-08-25T12:00:00.000Z';
    await service.getNotifications('user-1', {
      type: 'comments',
      limit: 12,
      before,
    });

    expect(builder.in).toHaveBeenCalledWith('type', [
      'comment_moment',
      'reply_comment',
      'mention_comment',
    ]);
    expect(builder.lt).toHaveBeenCalledWith('created_at', before);
    expect(builder.limit).toHaveBeenCalledWith(12);
  });

  it('fails closed when the inbox query fails', async () => {
    result = { data: null, error: { message: 'database unavailable' } };
    await expect(service.getNotifications('user-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('does not fabricate unread counts on provider failure', async () => {
    result = {
      data: null,
      error: { message: 'database unavailable' },
      count: 2,
    };
    await expect(service.getUnreadCount('user-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('marks only the authenticated recipient notification as read', async () => {
    await service.markAsRead('user-1', 'd0aa8e62-d334-4d0f-8450-ecb998ed3bf5');
    expect(builder.update).toHaveBeenCalledWith({ is_read: true });
    expect(builder.eq).toHaveBeenCalledWith('recipient_id', 'user-1');
  });

  it('marks only unread notifications for the authenticated recipient', async () => {
    await service.markAllAsRead('user-1');
    expect(builder.eq).toHaveBeenCalledWith('recipient_id', 'user-1');
    expect(builder.eq).toHaveBeenCalledWith('is_read', false);
  });

  it('fails closed when a read mutation fails', async () => {
    result = { data: null, error: { message: 'write failed' } };
    await expect(service.markAllAsRead('user-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

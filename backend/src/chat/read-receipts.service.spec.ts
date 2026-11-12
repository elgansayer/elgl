import { Test, TestingModule } from '@nestjs/testing';
import { ReadReceiptsService } from './read-receipts.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from './centrifugo.service';
import { vi } from 'vitest';

interface QueryResult {
  data?: unknown;
  error?: { message: string } | null;
  count?: number | null;
}

describe('ReadReceiptsService', () => {
  let service: ReadReceiptsService;
  let fromMock: any;
  let publishMock: any;
  const roomId = 'room-1';
  const userId = 'user-1';
  const messageId = 'message-1';

  beforeEach(async () => {
    fromMock = vi.fn();
    publishMock = vi.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadReceiptsService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => ({
              from: fromMock,
            }),
          },
        },
        {
          provide: CentrifugoService,
          useValue: {
            publish: publishMock,
          },
        },
      ],
    }).compile();

    service = module.get<ReadReceiptsService>(ReadReceiptsService);
  });

  const chain = (result: QueryResult) => {
    const builder: any = {};
    for (const method of [
      'select',
      'eq',
      'neq',
      'order',
      'in',
      'update',
      'upsert',
    ]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.single = vi.fn().mockResolvedValue(result);
    builder.maybeSingle = vi.fn().mockResolvedValue(result);
    builder.then = (resolve: (value: QueryResult) => unknown) =>
      Promise.resolve(result).then(resolve);
    return builder;
  };

  const messageRow = (overrides: Record<string, unknown> = {}) =>
    chain({
      data: {
        id: messageId,
        room_id: roomId,
        sender_id: 'user-2',
        delivery_status: 'sent',
        ...overrides,
      },
      error: null,
    });

  describe('markAsDelivered', () => {
    it('persists a delivered receipt and upgrades the message status', async () => {
      const receiptLookup = chain({ data: null, error: null });
      const upsert = chain({ error: null });
      const receiptTotals = chain({
        data: [{ status: 'delivered' }],
        error: null,
      });
      const recipients = chain({ data: null, count: 1 });
      const update = chain({ error: null });
      fromMock
        .mockReturnValueOnce(messageRow())
        .mockReturnValueOnce(receiptLookup)
        .mockReturnValueOnce(upsert)
        .mockReturnValueOnce(receiptTotals)
        .mockReturnValueOnce(recipients)
        .mockReturnValueOnce(update);

      await service.markAsDelivered(messageId, roomId, userId);

      expect(upsert.upsert).toHaveBeenCalledWith(
        {
          message_id: messageId,
          user_id: userId,
          status: 'delivered',
          read_at: null,
        },
        { onConflict: 'message_id,user_id' },
      );
      expect(update.update).toHaveBeenCalledWith({
        delivery_status: 'delivered',
      });
      expect(publishMock).toHaveBeenCalledWith(`chat:${roomId}`, {
        status_update: {
          message_id: messageId,
          delivery_status: 'delivered',
        },
      });
      expect(publishMock).toHaveBeenCalledWith(`chat:${roomId}:receipts`, {
        type: 'receipt_update',
        messageId,
        deliveryStatus: 'delivered',
      });
    });

    it('returns early without writing when the caller is the sender', async () => {
      fromMock.mockReturnValueOnce(messageRow({ sender_id: userId }));

      await service.markAsDelivered(messageId, roomId, userId);

      expect(fromMock).toHaveBeenCalledTimes(1);
      expect(publishMock).not.toHaveBeenCalled();
    });

    it('returns early when the receipt already exists at the same state', async () => {
      fromMock
        .mockReturnValueOnce(messageRow({ delivery_status: 'delivered' }))
        .mockReturnValueOnce(chain({ data: { status: 'delivered' } }));

      await service.markAsDelivered(messageId, roomId, userId);

      expect(fromMock).toHaveBeenCalledTimes(2);
      expect(publishMock).not.toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('persists a read receipt with a timestamp and upgrades the message', async () => {
      const receiptLookup = chain({ data: null, error: null });
      const upsert = chain({ error: null });
      const receiptTotals = chain({ data: [{ status: 'read' }], error: null });
      const recipients = chain({ data: null, count: 1 });
      const update = chain({ error: null });
      fromMock
        .mockReturnValueOnce(messageRow({ delivery_status: 'delivered' }))
        .mockReturnValueOnce(receiptLookup)
        .mockReturnValueOnce(upsert)
        .mockReturnValueOnce(receiptTotals)
        .mockReturnValueOnce(recipients)
        .mockReturnValueOnce(update);

      await service.markAsRead(messageId, roomId, userId);

      expect(upsert.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          message_id: messageId,
          user_id: userId,
          status: 'read',
          read_at: expect.any(String),
        }),
        { onConflict: 'message_id,user_id' },
      );
      expect(update.update).toHaveBeenCalledWith({ delivery_status: 'read' });
      expect(publishMock).toHaveBeenCalledWith(`chat:${roomId}`, {
        status_update: { message_id: messageId, delivery_status: 'read' },
      });
    });

    it('does not downgrade a receipt already marked read', async () => {
      fromMock
        .mockReturnValueOnce(messageRow({ delivery_status: 'read' }))
        .mockReturnValueOnce(chain({ data: { status: 'read' } }));

      await service.markAsRead(messageId, roomId, userId);

      expect(fromMock).toHaveBeenCalledTimes(2);
      expect(publishMock).not.toHaveBeenCalled();
    });

    it('keeps the message delivered when only some group members have read', async () => {
      const update = chain({ error: null });
      fromMock
        .mockReturnValueOnce(messageRow())
        .mockReturnValueOnce(chain({ data: null }))
        .mockReturnValueOnce(chain({ error: null }))
        .mockReturnValueOnce(
          chain({
            data: [{ status: 'read' }, { status: 'delivered' }],
            error: null,
          }),
        )
        .mockReturnValueOnce(chain({ data: null, count: 3 }))
        .mockReturnValueOnce(update);

      await service.markAsRead(messageId, roomId, userId);

      expect(update.update).toHaveBeenCalledWith({
        delivery_status: 'delivered',
      });
    });

    it('logs and stops when receipt persistence fails', async () => {
      fromMock
        .mockReturnValueOnce(messageRow())
        .mockReturnValueOnce(chain({ data: null }))
        .mockReturnValueOnce(chain({ error: { message: 'insert failed' } }));

      await service.markAsRead(messageId, roomId, userId);

      expect(fromMock).toHaveBeenCalledTimes(3);
      expect(publishMock).not.toHaveBeenCalled();
    });
  });

  describe('getReceiptStatus', () => {
    it('returns null when the message does not exist', async () => {
      fromMock.mockReturnValueOnce(chain({ data: null }));

      await expect(service.getReceiptStatus(messageId)).resolves.toBeNull();
    });

    it('returns null when the requester is not a room member', async () => {
      fromMock
        .mockReturnValueOnce(messageRow())
        .mockReturnValueOnce(chain({ data: null }));

      await expect(
        service.getReceiptStatus(messageId, 'outsider'),
      ).resolves.toBeNull();
    });

    it('returns the read-by list with reader profiles and recipient count', async () => {
      fromMock
        .mockReturnValueOnce(messageRow({ delivery_status: 'read' }))
        .mockReturnValueOnce(chain({ data: { user_id: userId } }))
        .mockReturnValueOnce(
          chain({
            data: [
              {
                user_id: 'user-2',
                status: 'read',
                read_at: '2026-11-09T10:00:00.000Z',
              },
            ],
            error: null,
          }),
        )
        .mockReturnValueOnce(
          chain({
            data: [
              {
                id: 'user-2',
                display_name: 'Partner',
                avatar_url: '/partner.png',
              },
            ],
            error: null,
          }),
        )
        .mockReturnValueOnce(chain({ data: null, count: 1 }));

      const status = await service.getReceiptStatus(messageId, userId);

      expect(status).toEqual({
        messageId,
        deliveryStatus: 'read',
        readBy: [
          {
            userId: 'user-2',
            displayName: 'Partner',
            avatarUrl: '/partner.png',
            readAt: '2026-11-09T10:00:00.000Z',
          },
        ],
        totalMembers: 1,
      });
    });

    it('returns an empty read-by list when nobody has read yet', async () => {
      fromMock
        .mockReturnValueOnce(messageRow({ delivery_status: 'sent' }))
        .mockReturnValueOnce(chain({ data: { user_id: userId } }))
        .mockReturnValueOnce(chain({ data: [], error: null }))
        .mockReturnValueOnce(chain({ data: null, count: 2 }));

      const status = await service.getReceiptStatus(messageId, userId);

      expect(status).toEqual({
        messageId,
        deliveryStatus: 'sent',
        readBy: [],
        totalMembers: 2,
      });
    });

    it('defaults to sent when the stored status is missing', async () => {
      fromMock
        .mockReturnValueOnce(messageRow({ delivery_status: null }))
        .mockReturnValueOnce(chain({ data: { user_id: userId } }))
        .mockReturnValueOnce(chain({ data: [], error: null }))
        .mockReturnValueOnce(chain({ data: null, count: 1 }));

      const status = await service.getReceiptStatus(messageId, userId);

      expect(status?.deliveryStatus).toBe('sent');
    });
  });

  describe('markAllAsRead', () => {
    it('updates unread messages and persists bulk read receipts', async () => {
      const updateChain = chain({
        data: [{ id: 'message-1' }, { id: 'message-2' }],
        error: null,
      });
      const upsert = chain({ error: null });
      fromMock.mockReturnValueOnce(updateChain).mockReturnValueOnce(upsert);

      await service.markAllAsRead(roomId, userId);

      expect(updateChain.update).toHaveBeenCalledWith({
        delivery_status: 'read',
      });
      expect(updateChain.eq).toHaveBeenCalledWith('room_id', roomId);
      expect(updateChain.neq).toHaveBeenNthCalledWith(1, 'sender_id', userId);
      expect(updateChain.neq).toHaveBeenNthCalledWith(
        2,
        'delivery_status',
        'read',
      );
      expect(upsert.upsert).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            message_id: 'message-1',
            user_id: userId,
            status: 'read',
          }),
          expect.objectContaining({
            message_id: 'message-2',
            user_id: userId,
            status: 'read',
          }),
        ],
        { onConflict: 'message_id,user_id' },
      );
      expect(publishMock).toHaveBeenCalledWith(`chat:${roomId}:receipts`, {
        type: 'bulk_read',
        readBy: userId,
        messageIds: ['message-1', 'message-2'],
      });
    });

    it('does not update or publish when there is nothing unread', async () => {
      fromMock.mockReturnValueOnce(chain({ data: [], error: null }));

      await service.markAllAsRead(roomId, userId);

      expect(fromMock).toHaveBeenCalledTimes(1);
      expect(publishMock).not.toHaveBeenCalled();
    });
  });

  describe('setInitialSent', () => {
    it('sets status to sent on creation', async () => {
      const update = chain({ error: null });
      fromMock.mockReturnValue(update);

      await service.setInitialSent(messageId);

      expect(update.update).toHaveBeenCalledWith({ delivery_status: 'sent' });
      expect(update.eq).toHaveBeenCalledWith('id', messageId);
    });
  });
});

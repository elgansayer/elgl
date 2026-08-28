import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ReadReceiptsService } from './read-receipts.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from './centrifugo.service';

describe('ReadReceiptsService', () => {
  let service: ReadReceiptsService;
  let fromMock: Mock;
  let publishMock: Mock;

  const messageId = 'message-1';
  const roomId = 'room-1';
  const userId = 'reader-1';

  beforeEach(async () => {
    fromMock = vi.fn();
    publishMock = vi.fn().mockResolvedValue(undefined);

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ReadReceiptsService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue({ from: fromMock }),
          },
        },
        {
          provide: CentrifugoService,
          useValue: { publish: publishMock },
        },
      ],
    }).compile();

    service = moduleRef.get<ReadReceiptsService>(ReadReceiptsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function selectSingle(data: unknown) {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data, error: null }),
    };
  }

  function updateById() {
    return {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
  }

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('markAsDelivered', () => {
    it('moves a sent message to delivered and publishes the receipt', async () => {
      const lookup = selectSingle({
        delivery_status: 'sent',
        sender_id: 'sender-1',
      });
      const update = updateById();
      fromMock.mockReturnValueOnce(lookup).mockReturnValueOnce(update);

      await service.markAsDelivered(messageId, roomId, userId);

      expect(update.update).toHaveBeenCalledWith({ delivery_status: 'delivered' });
      expect(update.eq).toHaveBeenCalledWith('id', messageId);
      expect(publishMock).toHaveBeenCalledWith(`chat:${roomId}:receipts`, {
        type: 'receipt_update',
        messageId,
        deliveryStatus: 'delivered',
      });
    });

    it('does not update a missing message', async () => {
      fromMock.mockReturnValue(selectSingle(null));

      await service.markAsDelivered(messageId, roomId, userId);

      expect(fromMock).toHaveBeenCalledTimes(1);
      expect(publishMock).not.toHaveBeenCalled();
    });

    it('does not mark the sender own message as delivered', async () => {
      fromMock.mockReturnValue(
        selectSingle({ delivery_status: 'sent', sender_id: userId }),
      );

      await service.markAsDelivered(messageId, roomId, userId);

      expect(fromMock).toHaveBeenCalledTimes(1);
      expect(publishMock).not.toHaveBeenCalled();
    });

    it.each(['delivered', 'read'])('does not downgrade a %s message', async (status) => {
      fromMock.mockReturnValue(
        selectSingle({ delivery_status: status, sender_id: 'sender-1' }),
      );

      await service.markAsDelivered(messageId, roomId, userId);

      expect(fromMock).toHaveBeenCalledTimes(1);
      expect(publishMock).not.toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it.each(['sent', 'delivered'])(
      'moves a %s message to read and publishes the receipt',
      async (status) => {
        const lookup = selectSingle({
          delivery_status: status,
          sender_id: 'sender-1',
        });
        const update = updateById();
        fromMock.mockReturnValueOnce(lookup).mockReturnValueOnce(update);

        await service.markAsRead(messageId, roomId, userId);

        expect(update.update).toHaveBeenCalledWith({ delivery_status: 'read' });
        expect(update.eq).toHaveBeenCalledWith('id', messageId);
        expect(publishMock).toHaveBeenCalledWith(`chat:${roomId}:receipts`, {
          type: 'receipt_update',
          messageId,
          deliveryStatus: 'read',
        });
      },
    );

    it('does not publish a duplicate receipt for an already-read message', async () => {
      fromMock.mockReturnValue(
        selectSingle({ delivery_status: 'read', sender_id: 'sender-1' }),
      );

      await service.markAsRead(messageId, roomId, userId);

      expect(fromMock).toHaveBeenCalledTimes(1);
      expect(publishMock).not.toHaveBeenCalled();
    });

    it('does not mark the sender own message as read', async () => {
      fromMock.mockReturnValue(
        selectSingle({ delivery_status: 'sent', sender_id: userId }),
      );

      await service.markAsRead(messageId, roomId, userId);

      expect(fromMock).toHaveBeenCalledTimes(1);
      expect(publishMock).not.toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('updates unread messages from other senders and publishes one bulk receipt', async () => {
      const lookup = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
      };
      lookup.neq
        .mockReturnValueOnce(lookup)
        .mockResolvedValueOnce({
          data: [{ id: 'message-1' }, { id: 'message-2' }],
          error: null,
        });
      const update = {
        update: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ error: null }),
      };
      fromMock.mockReturnValueOnce(lookup).mockReturnValueOnce(update);

      await service.markAllAsRead(roomId, userId);

      expect(lookup.eq).toHaveBeenCalledWith('room_id', roomId);
      expect(lookup.neq).toHaveBeenNthCalledWith(1, 'sender_id', userId);
      expect(lookup.neq).toHaveBeenNthCalledWith(2, 'delivery_status', 'read');
      expect(update.update).toHaveBeenCalledWith({ delivery_status: 'read' });
      expect(update.in).toHaveBeenCalledWith('id', ['message-1', 'message-2']);
      expect(publishMock).toHaveBeenCalledWith(`chat:${roomId}:receipts`, {
        type: 'bulk_read',
        readBy: userId,
        messageIds: ['message-1', 'message-2'],
      });
    });

    it('does not update or publish when there is nothing unread', async () => {
      const lookup = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
      };
      lookup.neq
        .mockReturnValueOnce(lookup)
        .mockResolvedValueOnce({ data: [], error: null });
      fromMock.mockReturnValue(lookup);

      await service.markAllAsRead(roomId, userId);

      expect(fromMock).toHaveBeenCalledTimes(1);
      expect(publishMock).not.toHaveBeenCalled();
    });
  });

  describe('getReceiptStatus', () => {
    it('returns null when the message does not exist', async () => {
      fromMock.mockReturnValue(selectSingle(null));

      await expect(service.getReceiptStatus(messageId)).resolves.toBeNull();
    });

    it('returns the stored delivery status', async () => {
      fromMock.mockReturnValue(
        selectSingle({
          id: messageId,
          delivery_status: 'delivered',
          room_id: roomId,
        }),
      );

      await expect(service.getReceiptStatus(messageId)).resolves.toEqual({
        messageId,
        deliveryStatus: 'delivered',
        readBy: [],
        totalMembers: 0,
      });
    });

    it('defaults a missing delivery status to sent', async () => {
      fromMock.mockReturnValue(
        selectSingle({ id: messageId, delivery_status: null, room_id: roomId }),
      );

      await expect(service.getReceiptStatus(messageId)).resolves.toEqual({
        messageId,
        deliveryStatus: 'sent',
        readBy: [],
        totalMembers: 0,
      });
    });
  });

  describe('setInitialSent', () => {
    it('initialises the persisted delivery status', async () => {
      const update = updateById();
      fromMock.mockReturnValue(update);

      await service.setInitialSent(messageId);

      expect(update.update).toHaveBeenCalledWith({ delivery_status: 'sent' });
      expect(update.eq).toHaveBeenCalledWith('id', messageId);
      expect(publishMock).not.toHaveBeenCalled();
    });
  });
});

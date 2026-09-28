import { Test, TestingModule } from '@nestjs/testing';
import { ReadReceiptsService } from './read-receipts.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from './centrifugo.service';
import { vi } from 'vitest';

describe('ReadReceiptsService', () => {
  let service: ReadReceiptsService;
  let fromMock: any;
  let publishMock: any;
  const roomId = 'room-1';
  const userId = 'user-1';
  const messageId = 'message-1';

  beforeEach(async () => {
    fromMock = vi.fn();
    publishMock = vi.fn();

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

  const selectSingle = (data: any) => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data, error: null }),
      update: vi.fn().mockReturnThis(),
    };
    return chain;
  };

  describe('markAsDelivered', () => {
    it('updates status and publishes when message is sent by another user and is currently "sent"', async () => {
      const lookup = selectSingle({
        id: messageId,
        delivery_status: 'sent',
        sender_id: 'user-2',
      });
      const update = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      fromMock.mockReturnValueOnce(lookup).mockReturnValueOnce(update);

      await service.markAsDelivered(messageId, roomId, userId);

      expect(lookup.eq).toHaveBeenCalledWith('id', messageId);
      expect(update.update).toHaveBeenCalledWith({
        delivery_status: 'delivered',
      });
      expect(update.eq).toHaveBeenCalledWith('id', messageId);
      expect(publishMock).toHaveBeenCalledWith(`chat:${roomId}:receipts`, {
        type: 'receipt_update',
        messageId,
        deliveryStatus: 'delivered',
      });
    });

    it('returns early if the user is the sender', async () => {
      fromMock.mockReturnValue(
        selectSingle({
          id: messageId,
          delivery_status: 'sent',
          sender_id: userId,
        }),
      );

      await service.markAsDelivered(messageId, roomId, userId);

      expect(fromMock).toHaveBeenCalledTimes(1);
      expect(publishMock).not.toHaveBeenCalled();
    });

    it('returns early if the message is already delivered or read', async () => {
      fromMock.mockReturnValue(
        selectSingle({
          id: messageId,
          delivery_status: 'delivered',
          sender_id: 'user-2',
        }),
      );

      await service.markAsDelivered(messageId, roomId, userId);

      expect(fromMock).toHaveBeenCalledTimes(1);
      expect(publishMock).not.toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('updates status and publishes when message is from another user and not read yet', async () => {
      const lookup = selectSingle({
        id: messageId,
        delivery_status: 'delivered',
        sender_id: 'user-2',
      });
      const update = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      fromMock.mockReturnValueOnce(lookup).mockReturnValueOnce(update);

      await service.markAsRead(messageId, roomId, userId);

      expect(lookup.eq).toHaveBeenCalledWith('id', messageId);
      expect(update.update).toHaveBeenCalledWith({ delivery_status: 'read' });
      expect(update.eq).toHaveBeenCalledWith('id', messageId);
      expect(publishMock).toHaveBeenCalledWith(`chat:${roomId}:receipts`, {
        type: 'receipt_update',
        messageId,
        deliveryStatus: 'read',
      });
    });

    it('returns early if the user is the sender', async () => {
      fromMock.mockReturnValue(
        selectSingle({
          id: messageId,
          delivery_status: 'delivered',
          sender_id: userId,
        }),
      );

      await service.markAsRead(messageId, roomId, userId);

      expect(fromMock).toHaveBeenCalledTimes(1);
      expect(publishMock).not.toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('updates unread messages from other senders and publishes one bulk receipt', async () => {
      const updateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: [{ id: 'message-1' }, { id: 'message-2' }],
          error: null,
        }),
      };
      fromMock.mockReturnValue(updateChain);

      await service.markAllAsRead(roomId, userId);

      expect(updateChain.update).toHaveBeenCalledWith({ delivery_status: 'read' });
      expect(updateChain.eq).toHaveBeenCalledWith('room_id', roomId);
      expect(updateChain.neq).toHaveBeenNthCalledWith(1, 'sender_id', userId);
      expect(updateChain.neq).toHaveBeenNthCalledWith(2, 'delivery_status', 'read');
      expect(updateChain.select).toHaveBeenCalledWith('id');

      expect(publishMock).toHaveBeenCalledWith(`chat:${roomId}:receipts`, {
        type: 'bulk_read',
        readBy: userId,
        messageIds: ['message-1', 'message-2'],
      });
    });

    it('does not update or publish when there is nothing unread', async () => {
      const updateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      fromMock.mockReturnValue(updateChain);

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

      const status = await service.getReceiptStatus(messageId);
      expect(status).toEqual({
        messageId,
        deliveryStatus: 'delivered',
        readBy: [],
        totalMembers: 0,
      });
    });

    it('defaults to sent if status is missing in db', async () => {
      fromMock.mockReturnValue(
        selectSingle({
          id: messageId,
          delivery_status: null,
          room_id: roomId,
        }),
      );

      const status = await service.getReceiptStatus(messageId);
      expect(status?.deliveryStatus).toBe('sent');
    });
  });

  describe('setInitialSent', () => {
    it('sets status to sent on creation', async () => {
      const update = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      fromMock.mockReturnValue(update);

      await service.setInitialSent(messageId);

      expect(update.update).toHaveBeenCalledWith({ delivery_status: 'sent' });
      expect(update.eq).toHaveBeenCalledWith('id', messageId);
    });
  });
});

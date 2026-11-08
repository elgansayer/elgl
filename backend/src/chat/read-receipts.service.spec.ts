import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ReadReceiptsService } from './read-receipts.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from './centrifugo.service';
import { vi } from 'vitest';

describe('ReadReceiptsService', () => {
  let service: ReadReceiptsService;
  let fromMock: ReturnType<typeof vi.fn>;
  let publishMock: ReturnType<typeof vi.fn>;
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

  const messageLookup = (data: unknown) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error: null }),
  });

  const updateChain = (error: unknown = null) => ({
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error }),
  });

  const upsertChain = (error: unknown = null) => ({
    upsert: vi.fn().mockResolvedValue({ error }),
  });

  const rowList = (data: unknown[]) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data, error: null }),
  });

  describe('markAsDelivered', () => {
    it('records a receipt, updates the aggregate status and publishes', async () => {
      const lookup = messageLookup({
        id: messageId,
        delivery_status: 'sent',
        sender_id: 'user-2',
      });
      const upsert = upsertChain();
      const update = updateChain();
      fromMock
        .mockReturnValueOnce(lookup)
        .mockReturnValueOnce(upsert)
        .mockReturnValueOnce(update);

      await service.markAsDelivered(messageId, roomId, userId);

      expect(lookup.eq).toHaveBeenCalledWith('id', messageId);
      expect(upsert.upsert).toHaveBeenCalledWith(
        {
          message_id: messageId,
          user_id: userId,
          status: 'delivered',
        },
        { onConflict: 'message_id,user_id', ignoreDuplicates: true },
      );
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
        messageLookup({
          id: messageId,
          delivery_status: 'sent',
          sender_id: userId,
        }),
      );

      await service.markAsDelivered(messageId, roomId, userId);

      expect(fromMock).toHaveBeenCalledTimes(1);
      expect(publishMock).not.toHaveBeenCalled();
    });

    it('records the per-user receipt without republishing an already delivered message', async () => {
      const lookup = messageLookup({
        id: messageId,
        delivery_status: 'delivered',
        sender_id: 'user-2',
      });
      const upsert = upsertChain();
      fromMock.mockReturnValueOnce(lookup).mockReturnValueOnce(upsert);

      await service.markAsDelivered(messageId, roomId, userId);

      expect(upsert.upsert).toHaveBeenCalled();
      expect(publishMock).not.toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('records a read receipt, updates the aggregate status and publishes', async () => {
      const lookup = messageLookup({
        id: messageId,
        delivery_status: 'delivered',
        sender_id: 'user-2',
      });
      const upsert = upsertChain();
      const update = updateChain();
      fromMock
        .mockReturnValueOnce(lookup)
        .mockReturnValueOnce(upsert)
        .mockReturnValueOnce(update);

      await service.markAsRead(messageId, roomId, userId);

      expect(lookup.eq).toHaveBeenCalledWith('id', messageId);
      expect(upsert.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          message_id: messageId,
          user_id: userId,
          status: 'read',
          read_at: expect.any(String),
        }),
        { onConflict: 'message_id,user_id', ignoreDuplicates: false },
      );
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
        messageLookup({
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

  describe('recordReceipt', () => {
    it('logs and swallows persistence failures so delivery is not blocked', async () => {
      const upsert = upsertChain({ message: 'write failed' });
      fromMock.mockReturnValue(upsert);

      await expect(
        service.recordReceipt(messageId, userId, 'read'),
      ).resolves.toBeUndefined();
      expect(upsert.upsert).toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('updates unread messages, records receipts and publishes one bulk receipt', async () => {
      const updateChainWithSelect = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: [{ id: 'message-1' }, { id: 'message-2' }],
          error: null,
        }),
      };
      const upsert = upsertChain();
      fromMock
        .mockReturnValueOnce(updateChainWithSelect)
        .mockReturnValueOnce(upsert);

      await service.markAllAsRead(roomId, userId);

      expect(updateChainWithSelect.update).toHaveBeenCalledWith({
        delivery_status: 'read',
      });
      expect(updateChainWithSelect.eq).toHaveBeenCalledWith('room_id', roomId);
      expect(updateChainWithSelect.neq).toHaveBeenNthCalledWith(
        1,
        'sender_id',
        userId,
      );
      expect(updateChainWithSelect.neq).toHaveBeenNthCalledWith(
        2,
        'delivery_status',
        'read',
      );
      expect(updateChainWithSelect.select).toHaveBeenCalledWith('id');
      expect(upsert.upsert).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            message_id: 'message-1',
            user_id: userId,
            status: 'read',
            read_at: expect.any(String),
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
      const updateChainWithSelect = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      fromMock.mockReturnValue(updateChainWithSelect);

      await service.markAllAsRead(roomId, userId);

      expect(fromMock).toHaveBeenCalledTimes(1);
      expect(publishMock).not.toHaveBeenCalled();
    });
  });

  describe('getReceiptStatus', () => {
    it('returns null when the message does not exist', async () => {
      fromMock.mockReturnValue(messageLookup(null));

      await expect(service.getReceiptStatus(messageId)).resolves.toBeNull();
    });

    it('returns the stored delivery status when no receipts exist', async () => {
      fromMock
        .mockReturnValueOnce(
          messageLookup({
            id: messageId,
            delivery_status: 'delivered',
            room_id: roomId,
            sender_id: 'user-2',
          }),
        )
        .mockReturnValueOnce(
          rowList([{ user_id: 'user-1' }, { user_id: 'user-2' }]),
        )
        .mockReturnValueOnce(rowList([]));

      const status = await service.getReceiptStatus(messageId);
      expect(status).toEqual({
        messageId,
        deliveryStatus: 'delivered',
        readBy: [],
        totalMembers: 1,
      });
    });

    it('returns everyone who read a group message', async () => {
      const readAt = '2026-11-08T10:00:00.000Z';
      fromMock
        .mockReturnValueOnce(
          messageLookup({
            id: messageId,
            delivery_status: 'delivered',
            room_id: roomId,
            sender_id: 'sender-1',
          }),
        )
        .mockReturnValueOnce(
          rowList([
            { user_id: 'sender-1' },
            { user_id: 'user-1' },
            { user_id: 'user-2' },
          ]),
        )
        .mockReturnValueOnce(
          rowList([
            {
              user_id: 'user-1',
              status: 'read',
              read_at: readAt,
              user: {
                display_name: 'Amara',
                avatar_url: 'https://cdn.example.test/amara.png',
              },
            },
            {
              user_id: 'user-2',
              status: 'delivered',
              read_at: null,
              user: { display_name: 'Bilal', avatar_url: null },
            },
          ]),
        );

      const status = await service.getReceiptStatus(messageId, 'sender-1');

      expect(status?.deliveryStatus).toBe('delivered');
      expect(status?.totalMembers).toBe(2);
      expect(status?.readBy).toEqual([
        {
          userId: 'user-1',
          displayName: 'Amara',
          avatarUrl: 'https://cdn.example.test/amara.png',
          readAt,
        },
      ]);
    });

    it('marks the message read once every recipient has read it', async () => {
      fromMock
        .mockReturnValueOnce(
          messageLookup({
            id: messageId,
            delivery_status: 'delivered',
            room_id: roomId,
            sender_id: 'sender-1',
          }),
        )
        .mockReturnValueOnce(
          rowList([{ user_id: 'sender-1' }, { user_id: 'user-1' }]),
        )
        .mockReturnValueOnce(
          rowList([
            {
              user_id: 'user-1',
              status: 'read',
              read_at: '2026-11-08T10:00:00.000Z',
              user: { display_name: 'Amara', avatar_url: null },
            },
          ]),
        );

      const status = await service.getReceiptStatus(messageId);

      expect(status?.deliveryStatus).toBe('read');
      expect(status?.readBy).toHaveLength(1);
    });

    it('rejects viewers who are not members of the room', async () => {
      fromMock
        .mockReturnValueOnce(
          messageLookup({
            id: messageId,
            delivery_status: 'sent',
            room_id: roomId,
            sender_id: 'sender-1',
          }),
        )
        .mockReturnValueOnce(rowList([{ user_id: 'user-2' }]));

      await expect(
        service.getReceiptStatus(messageId, 'intruder'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects room members who do not own the message', async () => {
      fromMock
        .mockReturnValueOnce(
          messageLookup({
            id: messageId,
            delivery_status: 'read',
            room_id: roomId,
            sender_id: 'sender-1',
          }),
        )
        .mockReturnValueOnce(
          rowList([{ user_id: 'sender-1' }, { user_id: 'recipient-1' }]),
        );

      await expect(
        service.getReceiptStatus(messageId, 'recipient-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(fromMock).toHaveBeenCalledTimes(2);
    });

    it('defaults to sent if status is missing in db', async () => {
      fromMock
        .mockReturnValueOnce(
          messageLookup({
            id: messageId,
            delivery_status: null,
            room_id: roomId,
            sender_id: 'user-2',
          }),
        )
        .mockReturnValueOnce(rowList([{ user_id: 'user-1' }]))
        .mockReturnValueOnce(rowList([]));

      const status = await service.getReceiptStatus(messageId);
      expect(status?.deliveryStatus).toBe('sent');
    });
  });

  describe('setInitialSent', () => {
    it('sets status to sent on creation', async () => {
      const update = updateChain();
      fromMock.mockReturnValue(update);

      await service.setInitialSent(messageId);

      expect(update.update).toHaveBeenCalledWith({ delivery_status: 'sent' });
      expect(update.eq).toHaveBeenCalledWith('id', messageId);
    });
  });
});

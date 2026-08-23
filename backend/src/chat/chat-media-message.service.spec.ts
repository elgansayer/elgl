import {
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { R2ObjectService } from '../cloudflare-r2/r2-object.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ChatMediaMessageService } from './chat-media-message.service';
import { ChatService } from './chat.service';

describe('ChatMediaMessageService', () => {
  const maybeSingle = jest.fn();
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle,
  };
  const from = jest.fn(() => query);
  const getClient = jest.fn(() => ({ from }));
  const supabaseService = { getClient } as unknown as SupabaseService;
  const publicUrlForKey = jest.fn(
    (key: string) => `https://cdn.example/${key}`,
  );
  const r2ObjectService = { publicUrlForKey } as unknown as R2ObjectService;
  const sendMessage = jest.fn();
  const chatService = { sendMessage } as unknown as ChatService;

  let service: ChatMediaMessageService;

  beforeEach(() => {
    jest.clearAllMocks();
    maybeSingle.mockReset();
    sendMessage.mockReset();
    publicUrlForKey.mockReset();
    query.select.mockReturnThis();
    query.eq.mockReturnThis();
    from.mockReturnValue(query);
    getClient.mockReturnValue({ from });
    publicUrlForKey.mockImplementation(
      (key: string) => `https://cdn.example/${key}`,
    );
    service = new ChatMediaMessageService(
      r2ObjectService,
      supabaseService,
      chatService,
    );
  });

  it('derives the media URL server-side and sends an owned upload', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    sendMessage.mockResolvedValue({
      id: 'message-1',
      room_id: 'room-1',
      sender_id: 'user-1',
      message_type: 'image',
      media_url:
        'https://cdn.example/chat-media/user-1/image/hd/1-aaaaaaaaaaaaaaaaaaaaaaaa.jpg',
    });

    const result = await service.send('user-1', {
      roomId: 'room-1',
      mediaKind: 'image',
      objectKey: 'chat-media/user-1/image/hd/1-aaaaaaaaaaaaaaaaaaaaaaaa.jpg',
    });

    expect(publicUrlForKey).toHaveBeenCalledWith(
      'chat-media/user-1/image/hd/1-aaaaaaaaaaaaaaaaaaaaaaaa.jpg',
    );
    expect(sendMessage).toHaveBeenCalledWith('user-1', {
      room_id: 'room-1',
      message_type: 'image',
      media_url:
        'https://cdn.example/chat-media/user-1/image/hd/1-aaaaaaaaaaaaaaaaaaaaaaaa.jpg',
    });
    expect(result.id).toBe('message-1');
  });

  it('rejects another users object before persistence', async () => {
    await expect(
      service.send('user-1', {
        roomId: 'room-1',
        mediaKind: 'video',
        objectKey: 'chat-media/user-2/video/hd/1-aaaaaaaaaaaaaaaaaaaaaaaa.mp4',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(getClient).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('returns an existing matching message without duplicating it', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        id: 'message-existing',
        room_id: 'room-1',
        sender_id: 'user-1',
        message_type: 'video',
      },
      error: null,
    });

    const result = await service.send('user-1', {
      roomId: 'room-1',
      mediaKind: 'video',
      objectKey: 'chat-media/user-1/video/standard/1-aaaaaaaaaaaaaaaaaaaaaaaa.mp4',
    });

    expect(result.id).toBe('message-existing');
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('rejects reuse of an uploaded object in another room', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        id: 'message-existing',
        room_id: 'room-other',
        sender_id: 'user-1',
        message_type: 'image',
      },
      error: null,
    });

    await expect(
      service.send('user-1', {
        roomId: 'room-1',
        mediaKind: 'image',
        objectKey: 'chat-media/user-1/image/hd/1-aaaaaaaaaaaaaaaaaaaaaaaa.jpg',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('recovers the persisted row when publication fails after the insert', async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'message-raced',
          room_id: 'room-1',
          sender_id: 'user-1',
          message_type: 'image',
        },
        error: null,
      });
    sendMessage.mockRejectedValue(new Error('Centrifugo unavailable'));

    const result = await service.send('user-1', {
      roomId: 'room-1',
      mediaKind: 'image',
      objectKey: 'chat-media/user-1/image/hd/1-aaaaaaaaaaaaaaaaaaaaaaaa.jpg',
    });

    expect(result.id).toBe('message-raced');
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('fails closed when delivery state cannot be verified', async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });

    await expect(
      service.send('user-1', {
        roomId: 'room-1',
        mediaKind: 'image',
        objectKey: 'chat-media/user-1/image/hd/1-aaaaaaaaaaaaaaaaaaaaaaaa.jpg',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});

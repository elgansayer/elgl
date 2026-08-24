import {
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { R2ObjectService } from '../cloudflare-r2/r2-object.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ChatMediaMessageService } from './chat-media-message.service';
import { ChatService } from './chat.service';

describe('ChatMediaMessageService', () => {
  const maybeSingle = vi.fn();
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle,
  };
  const from = vi.fn(() => query);
  const getClient = vi.fn(() => ({ from }));
  const supabaseService = { getClient } as unknown as SupabaseService;
  const publicUrlForKey = vi.fn(
    (key: string) => `https://cdn.example/${key}`,
  );
  const r2ObjectService = { publicUrlForKey } as unknown as R2ObjectService;
  const sendMessage = vi.fn();
  const chatService = { sendMessage } as unknown as ChatService;

  let service: ChatMediaMessageService;

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('persists instant video uploads as the dedicated video_note message type', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    sendMessage.mockResolvedValue({
      id: 'video-note-1',
      room_id: 'room-1',
      sender_id: 'user-1',
      message_type: 'video_note',
      media_url:
        'https://cdn.example/chat-media/user-1/video/standard/1-aaaaaaaaaaaaaaaaaaaaaaaa.webm',
    });

    await service.send('user-1', {
      roomId: 'room-1',
      mediaKind: 'video',
      presentation: 'instant_video',
      objectKey:
        'chat-media/user-1/video/standard/1-aaaaaaaaaaaaaaaaaaaaaaaa.webm',
    });

    expect(sendMessage).toHaveBeenCalledWith('user-1', {
      room_id: 'room-1',
      message_type: 'video_note',
      media_url:
        'https://cdn.example/chat-media/user-1/video/standard/1-aaaaaaaaaaaaaaaaaaaaaaaa.webm',
    });
  });

  it('rejects instant-video presentation for non-video uploads before persistence', async () => {
    await expect(
      service.send('user-1', {
        roomId: 'room-1',
        mediaKind: 'image',
        presentation: 'instant_video',
        objectKey:
          'chat-media/user-1/image/standard/1-aaaaaaaaaaaaaaaaaaaaaaaa.jpg',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    expect(getClient).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
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
      objectKey:
        'chat-media/user-1/video/standard/1-aaaaaaaaaaaaaaaaaaaaaaaa.mp4',
    });

    expect(result.id).toBe('message-existing');
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('returns an existing matching instant video without charging another send', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        id: 'video-note-existing',
        room_id: 'room-1',
        sender_id: 'user-1',
        message_type: 'video_note',
      },
      error: null,
    });

    const result = await service.send('user-1', {
      roomId: 'room-1',
      mediaKind: 'video',
      presentation: 'instant_video',
      objectKey:
        'chat-media/user-1/video/standard/1-aaaaaaaaaaaaaaaaaaaaaaaa.webm',
    });

    expect(result.id).toBe('video-note-existing');
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('rejects reusing a normal video upload as an instant video note', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        id: 'message-existing',
        room_id: 'room-1',
        sender_id: 'user-1',
        message_type: 'video',
      },
      error: null,
    });

    await expect(
      service.send('user-1', {
        roomId: 'room-1',
        mediaKind: 'video',
        presentation: 'instant_video',
        objectKey:
          'chat-media/user-1/video/standard/1-aaaaaaaaaaaaaaaaaaaaaaaa.webm',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
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

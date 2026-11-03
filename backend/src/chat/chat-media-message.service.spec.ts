import {
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { R2ObjectService } from '../cloudflare-r2/r2-object.service';
import { R2GatewayError } from '../cloudflare-r2/r2.service';
import { SendChatMediaMessageDto } from '../media/dto/send-chat-media-message.dto';
import { MetricsService } from '../metrics/metrics.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ChatMediaMessageService } from './chat-media-message.service';
import { ChatService } from './chat.service';

describe('ChatMediaMessageService', () => {
  const maybeSingle = vi.fn();
  const query = {
    select: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle,
  };
  const membershipMaybeSingle = vi.fn();
  const membershipQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: membershipMaybeSingle,
  };
  const from = vi.fn((table: string) =>
    table === 'chat_room_members' ? membershipQuery : query,
  );
  const getClient = vi.fn(() => ({ from }));
  const supabaseService = { getClient } as unknown as SupabaseService;
  const publicUrlForKey = vi.fn((key: string) => `https://cdn.example/${key}`);
  const headObject = vi.fn();
  const r2ObjectService = {
    publicUrlForKey,
    headObject,
  } as unknown as R2ObjectService;
  const sendMessage = vi.fn();
  const republishMessage = vi.fn();
  const chatService = {
    sendMessage,
    republishMessage,
  } as unknown as ChatService;
  const recordChatMediaSend = vi.fn();
  const metricsService = { recordChatMediaSend } as unknown as MetricsService;

  let service: ChatMediaMessageService;

  beforeEach(() => {
    vi.clearAllMocks();
    // The service emits structured replay/recovery/conflict events; keep the run quiet.
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    maybeSingle.mockReset();
    membershipMaybeSingle.mockReset();
    sendMessage.mockReset();
    republishMessage.mockReset().mockResolvedValue(true);
    recordChatMediaSend.mockReset();
    publicUrlForKey.mockReset();
    headObject.mockReset();
    query.select.mockReturnThis();
    query.eq.mockReturnThis();
    membershipQuery.select.mockReturnThis();
    membershipQuery.eq.mockReturnThis();
    from.mockImplementation((table: string) =>
      table === 'chat_room_members' ? membershipQuery : query,
    );
    getClient.mockReturnValue({ from });
    membershipMaybeSingle.mockResolvedValue({
      data: { room_id: 'room-1' },
      error: null,
    });
    publicUrlForKey.mockImplementation(
      (key: string) => `https://cdn.example/${key}`,
    );
    headObject.mockImplementation((key: string) =>
      Promise.resolve({
        key,
        etag: 'etag',
        size: 48_000,
        contentType: 'image/png',
        uploadedAt: '2026-11-02T12:00:00.000Z',
      }),
    );
    service = new ChatMediaMessageService(
      r2ObjectService,
      supabaseService,
      chatService,
      metricsService,
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
    expect(sendMessage).toHaveBeenCalledWith(
      'user-1',
      {
        room_id: 'room-1',
        message_type: 'image',
        media_url:
          'https://cdn.example/chat-media/user-1/image/hd/1-aaaaaaaaaaaaaaaaaaaaaaaa.jpg',
      },
      { requireRealtimeDelivery: true },
    );
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

    expect(sendMessage).toHaveBeenCalledWith(
      'user-1',
      {
        room_id: 'room-1',
        message_type: 'video_note',
        media_url:
          'https://cdn.example/chat-media/user-1/video/standard/1-aaaaaaaaaaaaaaaaaaaaaaaa.webm',
      },
      { requireRealtimeDelivery: true },
    );
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

  it('rejects a non-member without looking up or creating a message', async () => {
    membershipMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      service.send('user-1', {
        roomId: 'room-1',
        mediaKind: 'image',
        objectKey:
          'chat-media/user-1/image/standard/1-aaaaaaaaaaaaaaaaaaaaaaaa.jpg',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(membershipQuery.eq).toHaveBeenCalledWith('room_id', 'room-1');
    expect(membershipQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(maybeSingle).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('fails closed and logs no identity when room membership cannot be verified', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    membershipMaybeSingle.mockResolvedValue({
      data: null,
      error: { code: 'provider-detail', message: 'private provider message' },
    });

    await expect(
      service.send('user-1', {
        roomId: 'room-1',
        mediaKind: 'image',
        objectKey:
          'chat-media/user-1/image/standard/1-aaaaaaaaaaaaaaaaaaaaaaaa.jpg',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(warn).toHaveBeenCalledWith(
      { event: 'chat_media_membership_lookup_failed' },
      'Unable to verify chat media room membership',
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain('user-1');
    expect(JSON.stringify(warn.mock.calls)).not.toContain(
      'private provider message',
    );
    expect(maybeSingle).not.toHaveBeenCalled();
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
    expect(republishMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'message-raced' }),
    );
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

  describe('doodles', () => {
    const doodleKey =
      'chat-media/user-1/doodle/standard/1-aaaaaaaaaaaaaaaaaaaaaaaa.png';
    const doodleUrl = `https://cdn.example/${doodleKey}`;

    it('persists an owned doodle upload as a doodle message with a server-derived URL', async () => {
      maybeSingle.mockResolvedValue({ data: null, error: null });
      sendMessage.mockResolvedValue({
        id: 'doodle-1',
        room_id: 'room-1',
        sender_id: 'user-1',
        message_type: 'doodle',
        media_url: doodleUrl,
      });

      const result = await service.send('user-1', {
        roomId: 'room-1',
        mediaKind: 'doodle',
        objectKey: doodleKey,
      });

      expect(publicUrlForKey).toHaveBeenCalledWith(doodleKey);
      expect(headObject).toHaveBeenCalledWith(doodleKey);
      expect(sendMessage).toHaveBeenCalledWith(
        'user-1',
        {
          room_id: 'room-1',
          message_type: 'doodle',
          media_url: doodleUrl,
        },
        { requireRealtimeDelivery: true },
      );
      expect(result.id).toBe('doodle-1');
    });

    it('rejects another users doodle object before persistence', async () => {
      await expect(
        service.send('user-1', {
          roomId: 'room-1',
          mediaKind: 'doodle',
          objectKey:
            'chat-media/user-2/doodle/standard/1-aaaaaaaaaaaaaaaaaaaaaaaa.png',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(getClient).not.toHaveBeenCalled();
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('does not let a doodle object be sent as a photo, or a photo as a doodle', async () => {
      await expect(
        service.send('user-1', {
          roomId: 'room-1',
          mediaKind: 'image',
          objectKey: doodleKey,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.send('user-1', {
          roomId: 'room-1',
          mediaKind: 'doodle',
          objectKey:
            'chat-media/user-1/image/standard/1-aaaaaaaaaaaaaaaaaaaaaaaa.png',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('rejects an instant-video presentation for a doodle before persistence', async () => {
      await expect(
        service.send('user-1', {
          roomId: 'room-1',
          mediaKind: 'doodle',
          presentation: 'instant_video',
          objectKey: doodleKey,
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(getClient).not.toHaveBeenCalled();
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('returns the existing doodle on a retry without sending a second message', async () => {
      maybeSingle.mockResolvedValue({
        data: {
          id: 'doodle-existing',
          room_id: 'room-1',
          sender_id: 'user-1',
          message_type: 'doodle',
        },
        error: null,
      });

      const result = await service.send('user-1', {
        roomId: 'room-1',
        mediaKind: 'doodle',
        objectKey: doodleKey,
      });

      expect(result.id).toBe('doodle-existing');
      expect(headObject).not.toHaveBeenCalled();
      expect(sendMessage).not.toHaveBeenCalled();
      expect(republishMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'doodle-existing' }),
      );
    });

    it('keeps a persisted doodle retryable until realtime publication succeeds', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn');
      const persisted = {
        id: 'doodle-existing',
        room_id: 'room-1',
        sender_id: 'user-1',
        message_type: 'doodle',
      };
      maybeSingle.mockResolvedValue({ data: persisted, error: null });
      republishMessage.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      await expect(
        service.send('user-1', {
          roomId: 'room-1',
          mediaKind: 'doodle',
          objectKey: doodleKey,
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      const result = await service.send('user-1', {
        roomId: 'room-1',
        mediaKind: 'doodle',
        objectKey: doodleKey,
      });

      expect(result.id).toBe('doodle-existing');
      expect(republishMessage).toHaveBeenCalledTimes(2);
      expect(sendMessage).not.toHaveBeenCalled();
      expect(recordChatMediaSend).toHaveBeenNthCalledWith(
        1,
        'doodle',
        'unavailable',
      );
      expect(recordChatMediaSend).toHaveBeenNthCalledWith(
        2,
        'doodle',
        'replayed',
      );
      expect(warn).toHaveBeenCalledWith(
        {
          event: 'chat_media_realtime_delivery_failed',
          mediaKind: 'doodle',
          messageType: 'doodle',
          messageId: 'doodle-existing',
        },
        'Unable to confirm realtime delivery for persisted chat media',
      );
      expect(JSON.stringify(warn.mock.calls)).not.toContain(doodleKey);
    });

    it('rejects a doodle object that was never uploaded', async () => {
      maybeSingle.mockResolvedValue({ data: null, error: null });
      headObject.mockRejectedValue(
        new R2GatewayError(404, 'OBJECT_NOT_FOUND', 'private provider detail'),
      );

      await expect(
        service.send('user-1', {
          roomId: 'room-1',
          mediaKind: 'doodle',
          objectKey: doodleKey,
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(sendMessage).not.toHaveBeenCalled();
      expect(recordChatMediaSend).toHaveBeenCalledWith('doodle', 'rejected');
    });

    it.each([
      ['an empty object', { size: 0 }],
      ['an oversized object', { size: 2 * 1024 * 1024 + 1 }],
      ['a non-PNG object', { contentType: 'image/jpeg' }],
      ['a mismatched key', { key: `${doodleKey}.other` }],
    ])('rejects %s before persistence', async (_label, override) => {
      maybeSingle.mockResolvedValue({ data: null, error: null });
      headObject.mockResolvedValue({
        key: doodleKey,
        etag: 'etag',
        size: 48_000,
        contentType: 'image/png; charset=binary',
        uploadedAt: '2026-11-02T12:00:00.000Z',
        ...override,
      });

      await expect(
        service.send('user-1', {
          roomId: 'room-1',
          mediaKind: 'doodle',
          objectKey: doodleKey,
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(sendMessage).not.toHaveBeenCalled();
      expect(recordChatMediaSend).toHaveBeenCalledWith('doodle', 'rejected');
    });

    it('fails closed with a sanitised event when object metadata is unavailable', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn');
      maybeSingle.mockResolvedValue({ data: null, error: null });
      headObject.mockRejectedValue(
        new R2GatewayError(503, 'PROVIDER_DOWN', 'private provider detail'),
      );

      await expect(
        service.send('user-1', {
          roomId: 'room-1',
          mediaKind: 'doodle',
          objectKey: doodleKey,
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      expect(warn).toHaveBeenCalledWith(
        {
          event: 'chat_media_object_lookup_failed',
          mediaKind: 'doodle',
          failure: 'HTTP 503',
        },
        'Unable to verify uploaded chat media object',
      );
      expect(JSON.stringify(warn.mock.calls)).not.toContain(doodleKey);
      expect(JSON.stringify(warn.mock.calls)).not.toContain(
        'private provider detail',
      );
      expect(sendMessage).not.toHaveBeenCalled();
      expect(recordChatMediaSend).toHaveBeenCalledWith('doodle', 'unavailable');
    });

    it('rejects reuse of a doodle object in another room', async () => {
      maybeSingle.mockResolvedValue({
        data: {
          id: 'doodle-existing',
          room_id: 'room-other',
          sender_id: 'user-1',
          message_type: 'doodle',
        },
        error: null,
      });

      await expect(
        service.send('user-1', {
          roomId: 'room-1',
          mediaKind: 'doodle',
          objectKey: doodleKey,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('recovers the persisted doodle when publication fails after the insert', async () => {
      maybeSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: {
            id: 'doodle-raced',
            room_id: 'room-1',
            sender_id: 'user-1',
            message_type: 'doodle',
          },
          error: null,
        });
      sendMessage.mockRejectedValue(new Error('Centrifugo unavailable'));

      const result = await service.send('user-1', {
        roomId: 'room-1',
        mediaKind: 'doodle',
        objectKey: doodleKey,
      });

      expect(result.id).toBe('doodle-raced');
      expect(sendMessage).toHaveBeenCalledTimes(1);
    });

    it('surfaces the original failure when no doodle row was persisted', async () => {
      const failure = new Error('Failed to save message: database unavailable');
      maybeSingle.mockResolvedValue({ data: null, error: null });
      sendMessage.mockRejectedValue(failure);

      await expect(
        service.send('user-1', {
          roomId: 'room-1',
          mediaKind: 'doodle',
          objectKey: doodleKey,
        }),
      ).rejects.toBe(failure);
    });

    it('logs replay and recovery as sanitised events without the media URL', async () => {
      const log = vi.spyOn(Logger.prototype, 'log');
      const warn = vi.spyOn(Logger.prototype, 'warn');
      maybeSingle.mockResolvedValueOnce({
        data: {
          id: 'doodle-existing',
          room_id: 'room-1',
          sender_id: 'user-1',
          message_type: 'doodle',
        },
        error: null,
      });

      await service.send('user-1', {
        roomId: 'room-1',
        mediaKind: 'doodle',
        objectKey: doodleKey,
      });

      maybeSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: {
            id: 'doodle-raced',
            room_id: 'room-1',
            sender_id: 'user-1',
            message_type: 'doodle',
          },
          error: null,
        });
      sendMessage.mockRejectedValue(new Error('Centrifugo unavailable'));
      await service.send('user-1', {
        roomId: 'room-1',
        mediaKind: 'doodle',
        objectKey: doodleKey,
      });

      expect(log).toHaveBeenCalledWith(
        {
          event: 'chat_media_send_replayed',
          mediaKind: 'doodle',
          messageType: 'doodle',
          messageId: 'doodle-existing',
        },
        expect.any(String),
      );
      expect(warn).toHaveBeenCalledWith(
        {
          event: 'chat_media_send_recovered',
          mediaKind: 'doodle',
          messageType: 'doodle',
          messageId: 'doodle-raced',
          failure: 'Error',
        },
        expect.any(String),
      );
      const logged = JSON.stringify([...log.mock.calls, ...warn.mock.calls]);
      expect(logged).not.toContain(doodleUrl);
      expect(logged).not.toContain('Centrifugo unavailable');
    });
  });

  describe('outcome metrics', () => {
    const doodleKey =
      'chat-media/user-1/doodle/standard/1-aaaaaaaaaaaaaaaaaaaaaaaa.png';
    const doodle: SendChatMediaMessageDto = {
      roomId: 'room-1',
      mediaKind: 'doodle',
      objectKey: doodleKey,
    };
    const persisted = (overrides: Record<string, unknown> = {}) => ({
      data: {
        id: 'doodle-existing',
        room_id: 'room-1',
        sender_id: 'user-1',
        message_type: 'doodle',
        ...overrides,
      },
      error: null,
    });

    it('counts a newly persisted doodle as created', async () => {
      maybeSingle.mockResolvedValue({ data: null, error: null });
      sendMessage.mockResolvedValue({ id: 'doodle-1', message_type: 'doodle' });

      await service.send('user-1', doodle);

      expect(recordChatMediaSend).toHaveBeenCalledTimes(1);
      expect(recordChatMediaSend).toHaveBeenCalledWith('doodle', 'created');
    });

    it('counts a retry that resolves to the existing message as replayed', async () => {
      maybeSingle.mockResolvedValue(persisted());

      await service.send('user-1', doodle);

      expect(recordChatMediaSend).toHaveBeenCalledTimes(1);
      expect(recordChatMediaSend).toHaveBeenCalledWith('doodle', 'replayed');
    });

    it('counts a message found again after a failed send as recovered, never as created', async () => {
      maybeSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce(persisted({ id: 'doodle-raced' }));
      sendMessage.mockRejectedValue(new Error('Centrifugo unavailable'));

      await service.send('user-1', doodle);

      expect(recordChatMediaSend).toHaveBeenCalledTimes(1);
      expect(recordChatMediaSend).toHaveBeenCalledWith('doodle', 'recovered');
    });

    const failures: {
      label: string;
      outcome: string;
      dto: SendChatMediaMessageDto;
      arrange: () => void;
    }[] = [
      {
        label: 'an object owned by another user',
        outcome: 'forbidden',
        dto: {
          ...doodle,
          objectKey:
            'chat-media/user-2/doodle/standard/1-aaaaaaaaaaaaaaaaaaaaaaaa.png',
        },
        arrange: () => undefined,
      },
      {
        label: 'a room the caller is not a member of',
        outcome: 'not_member',
        dto: doodle,
        arrange: () =>
          membershipMaybeSingle.mockResolvedValue({ data: null, error: null }),
      },
      {
        label: 'an object already used in another room',
        outcome: 'conflict',
        dto: doodle,
        arrange: () =>
          maybeSingle.mockResolvedValue(persisted({ room_id: 'room-other' })),
      },
      {
        label: 'a membership lookup that fails',
        outcome: 'unavailable',
        dto: doodle,
        arrange: () =>
          membershipMaybeSingle.mockResolvedValue({
            data: null,
            error: { message: 'down' },
          }),
      },
      {
        label: 'a delivery lookup that fails',
        outcome: 'unavailable',
        dto: doodle,
        arrange: () =>
          maybeSingle.mockResolvedValue({
            data: null,
            error: { message: 'down' },
          }),
      },
      {
        label: 'an invalid presentation',
        outcome: 'rejected',
        dto: { ...doodle, presentation: 'instant_video' },
        arrange: () => undefined,
      },
      {
        label: 'an unexpected send failure with nothing persisted',
        outcome: 'failed',
        dto: doodle,
        arrange: () => {
          maybeSingle.mockResolvedValue({ data: null, error: null });
          sendMessage.mockRejectedValue(new Error('Failed to save message'));
        },
      },
    ];

    it.each(failures)(
      'counts $label as $outcome exactly once',
      async ({ outcome, dto, arrange }) => {
        arrange();

        await expect(service.send('user-1', dto)).rejects.toBeDefined();

        expect(recordChatMediaSend).toHaveBeenCalledTimes(1);
        expect(recordChatMediaSend).toHaveBeenCalledWith('doodle', outcome);
      },
    );

    it('labels by media kind and exports nothing else', async () => {
      maybeSingle.mockResolvedValue({ data: null, error: null });
      sendMessage.mockResolvedValue({ id: 'image-1', message_type: 'image' });

      await service.send('user-1', {
        roomId: 'room-1',
        mediaKind: 'image',
        objectKey: 'chat-media/user-1/image/hd/1-aaaaaaaaaaaaaaaaaaaaaaaa.jpg',
      });

      expect(recordChatMediaSend.mock.calls).toEqual([['image', 'created']]);
    });
  });
});

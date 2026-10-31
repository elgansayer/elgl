import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NlpService } from '../nlp/nlp.service';
import { SpeechTranscriptionService } from '../nlp/speech-transcription.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { ChatVoiceTranscriptionService } from './chat-voice-transcription.service';
import { CentrifugoService } from './centrifugo.service';
import { ChatMessage } from './interfaces/chat-message.interface';

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'message-1',
    room_id: 'room-1',
    sender_id: 'sender-1',
    message_type: 'voice',
    media_url:
      'https://media.example.com/voice-notes/sender-1/voice-message.webm',
    is_read: true,
    created_at: '2026-10-31T10:00:00.000Z',
    voice_transcription_status: 'not_requested',
    voice_transcription_attempts: 0,
    ...overrides,
  };
}

function query(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
}

describe('ChatVoiceTranscriptionService', () => {
  let chatQueries: ReturnType<typeof query>[];
  let membershipQuery: ReturnType<typeof query>;
  let from: ReturnType<typeof vi.fn>;
  let nlpService: { checkRateLimit: ReturnType<typeof vi.fn> };
  let speechTranscription: {
    isConfigured: ReturnType<typeof vi.fn>;
    transcribeAudioUrl: ReturnType<typeof vi.fn>;
  };
  let usersService: { getProfile: ReturnType<typeof vi.fn> };
  let centrifugoService: { publish: ReturnType<typeof vi.fn> };
  let service: ChatVoiceTranscriptionService;

  beforeEach(() => {
    chatQueries = [];
    membershipQuery = query({ data: { user_id: 'user-1' }, error: null });
    from = vi.fn((table: string) => {
      if (table === 'chat_room_members') return membershipQuery;
      const next = chatQueries.shift();
      if (!next) throw new Error(`Unexpected query for ${table}`);
      return next;
    });
    nlpService = { checkRateLimit: vi.fn().mockResolvedValue(undefined) };
    speechTranscription = {
      isConfigured: vi.fn().mockReturnValue(true),
      transcribeAudioUrl: vi.fn(),
    };
    usersService = {
      getProfile: vi.fn().mockResolvedValue({ is_vip: false }),
    };
    centrifugoService = {
      publish: vi.fn().mockResolvedValue(true),
    };
    const configService = {
      get: vi.fn((key: string) =>
        key === 'CLOUDFLARE_R2_PUBLIC_URL'
          ? 'https://media.example.com'
          : undefined,
      ),
    };
    const supabaseService = {
      getClient: vi.fn().mockReturnValue({ from }),
    };

    service = new ChatVoiceTranscriptionService(
      configService as unknown as ConfigService,
      supabaseService as unknown as SupabaseService,
      nlpService as unknown as NlpService,
      speechTranscription as unknown as SpeechTranscriptionService,
      usersService as unknown as UsersService,
      centrifugoService as unknown as CentrifugoService,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects a caller who is not a member of the message room', async () => {
    chatQueries.push(query({ data: message(), error: null }));
    membershipQuery.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      service.requestTranscription('user-1', 'message-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(nlpService.checkRateLimit).not.toHaveBeenCalled();
    expect(speechTranscription.transcribeAudioUrl).not.toHaveBeenCalled();
  });

  it('rejects non-voice messages before spending transcription quota', async () => {
    chatQueries.push(
      query({
        data: message({ message_type: 'text', media_url: null }),
        error: null,
      }),
    );

    await expect(
      service.requestTranscription('user-1', 'message-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(nlpService.checkRateLimit).not.toHaveBeenCalled();
  });

  it('returns a completed transcript idempotently without another provider job', async () => {
    const ready = message({
      voice_transcription_status: 'ready',
      voice_transcript: 'Already stored',
    });
    chatQueries.push(query({ data: ready, error: null }));

    await expect(
      service.requestTranscription('user-1', 'message-1'),
    ).resolves.toEqual(ready);
    expect(nlpService.checkRateLimit).not.toHaveBeenCalled();
    expect(centrifugoService.publish).not.toHaveBeenCalled();
  });

  it('persists provider unavailability without spending AI allowance', async () => {
    const unavailable = message({
      voice_transcription_status: 'unavailable',
      voice_transcription_error_code: 'provider_unavailable',
    });
    chatQueries.push(
      query({ data: message(), error: null }),
      query({ data: unavailable, error: null }),
    );
    speechTranscription.isConfigured.mockReturnValue(false);

    await expect(
      service.requestTranscription('user-1', 'message-1'),
    ).resolves.toEqual(unavailable);

    expect(nlpService.checkRateLimit).not.toHaveBeenCalled();
    expect(speechTranscription.transcribeAudioUrl).not.toHaveBeenCalled();
    expect(centrifugoService.publish).toHaveBeenCalledWith('chat:room-1', {
      message: unavailable,
    });
  });

  it('queues one authorised request and publishes its pending state', async () => {
    const pending = message({ voice_transcription_status: 'pending' });
    chatQueries.push(
      query({ data: message(), error: null }),
      query({ data: pending, error: null }),
    );
    vi.spyOn(service, 'processMessage').mockResolvedValue(undefined);

    await expect(
      service.requestTranscription('user-1', 'message-1'),
    ).resolves.toEqual(pending);

    expect(usersService.getProfile).toHaveBeenCalledWith('user-1');
    expect(nlpService.checkRateLimit).toHaveBeenCalledWith('user-1', false);
    expect(centrifugoService.publish).toHaveBeenCalledWith('chat:room-1', {
      message: pending,
    });
    expect(service.processMessage).toHaveBeenCalledWith('message-1');
  });

  it('persists and broadcasts the authoritative provider transcript', async () => {
    const pending = message({ voice_transcription_status: 'pending' });
    const processing = message({
      voice_transcription_status: 'processing',
      voice_transcription_attempts: 1,
    });
    const ready = message({
      voice_transcription_status: 'ready',
      voice_transcription_attempts: 1,
      voice_transcript: 'Hello from the provider',
    });
    const pendingQuery = query({ data: pending, error: null });
    const claimQuery = query({ data: processing, error: null });
    const completionQuery = query({ data: ready, error: null });
    chatQueries.push(pendingQuery, claimQuery, completionQuery);
    speechTranscription.transcribeAudioUrl.mockResolvedValue({
      status: 'ready',
      transcript: 'Hello from the provider',
    });

    await service.processMessage('message-1');

    expect(speechTranscription.transcribeAudioUrl).toHaveBeenCalledWith(
      pending.media_url,
    );
    expect(completionQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        voice_transcription_status: 'ready',
        voice_transcript: 'Hello from the provider',
        voice_transcription_error_code: null,
      }),
    );
    expect(centrifugoService.publish).toHaveBeenLastCalledWith('chat:room-1', {
      message: ready,
    });
  });

  it('does not invoke the provider when another worker wins the claim', async () => {
    chatQueries.push(
      query({
        data: message({ voice_transcription_status: 'pending' }),
        error: null,
      }),
      query({ data: null, error: null }),
    );

    await service.processMessage('message-1');

    expect(speechTranscription.transcribeAudioUrl).not.toHaveBeenCalled();
  });

  it('fails an off-origin stored URL without asking Azure to fetch it', async () => {
    const pending = message({
      media_url: 'https://attacker.example/voice.webm',
      voice_transcription_status: 'pending',
    });
    const processing = message({
      ...pending,
      voice_transcription_status: 'processing',
      voice_transcription_attempts: 1,
    });
    const failed = message({
      ...processing,
      voice_transcription_status: 'failed',
      voice_transcription_error_code: 'untrusted_media_url',
    });
    const completionQuery = query({ data: failed, error: null });
    chatQueries.push(
      query({ data: pending, error: null }),
      query({ data: processing, error: null }),
      completionQuery,
    );

    await service.processMessage('message-1');

    expect(speechTranscription.transcribeAudioUrl).not.toHaveBeenCalled();
    expect(completionQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        voice_transcription_status: 'failed',
        voice_transcription_error_code: 'untrusted_media_url',
        voice_transcription_next_retry_at: expect.any(String),
      }),
    );
  });

  it('rejects transcription of an expired disappearing voice message', async () => {
    chatQueries.push(
      query({
        data: message({
          expires_at: new Date(Date.now() - 60_000).toISOString(),
        }),
        error: null,
      }),
    );

    await expect(
      service.requestTranscription('user-1', 'message-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(nlpService.checkRateLimit).not.toHaveBeenCalled();
    expect(speechTranscription.transcribeAudioUrl).not.toHaveBeenCalled();
  });

  it('does not process or broadcast a voice message that was deleted for everyone while queued', async () => {
    chatQueries.push(
      query({
        data: message({
          is_deleted_for_everyone: true,
          voice_transcription_status: 'pending',
        }),
        error: null,
      }),
    );

    await service.processMessage('message-1');

    expect(speechTranscription.transcribeAudioUrl).not.toHaveBeenCalled();
    expect(centrifugoService.publish).not.toHaveBeenCalled();
  });

  it('does not process or broadcast a voice message that expired while queued', async () => {
    chatQueries.push(
      query({
        data: message({
          expires_at: new Date(Date.now() - 10_000).toISOString(),
          voice_transcription_status: 'pending',
        }),
        error: null,
      }),
    );

    await service.processMessage('message-1');

    expect(speechTranscription.transcribeAudioUrl).not.toHaveBeenCalled();
    expect(centrifugoService.publish).not.toHaveBeenCalled();
  });

  it('fails directory traversal and subpath voice URLs without invoking the provider', async () => {
    const traversalUrls = [
      'https://media.example.com/voice-notes/sender-1/%2e%2e/%2e%2e/avatars/target.png',
      'https://media.example.com/voice-notes/sender-1/nested/voice.webm',
      'https://media.example.com/voice-notes/sender-1/',
    ];

    for (const [index, mediaUrl] of traversalUrls.entries()) {
      const messageId = `message-traversal-${index}`;
      const pending = message({
        id: messageId,
        media_url: mediaUrl,
        voice_transcription_status: 'pending',
      });
      const processing = message({
        ...pending,
        voice_transcription_status: 'processing',
        voice_transcription_attempts: 1,
      });
      const failed = message({
        ...processing,
        voice_transcription_status: 'failed',
        voice_transcription_error_code: 'untrusted_media_url',
      });
      const completionQuery = query({ data: failed, error: null });
      chatQueries.push(
        query({ data: pending, error: null }),
        query({ data: processing, error: null }),
        completionQuery,
      );

      await service.processMessage(messageId);

      expect(speechTranscription.transcribeAudioUrl).not.toHaveBeenCalled();
      expect(completionQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          voice_transcription_status: 'failed',
          voice_transcription_error_code: 'untrusted_media_url',
        }),
      );
    }
  });

  it('bounds the scheduled batch to due rows with attempts remaining', async () => {
    const recoveryQuery = query({ data: null, error: null });
    const queueQuery = query({ data: [], error: null });
    chatQueries.push(recoveryQuery, queueQuery);

    await service.processPendingTranscriptions();

    expect(queueQuery.lt).toHaveBeenCalledWith(
      'voice_transcription_attempts',
      4,
    );
    expect(queueQuery.or).toHaveBeenCalledWith(
      expect.stringContaining('voice_transcription_next_retry_at.lte.'),
    );
    expect(queueQuery.limit).toHaveBeenCalledWith(5);
    expect(speechTranscription.transcribeAudioUrl).not.toHaveBeenCalled();
  });
});

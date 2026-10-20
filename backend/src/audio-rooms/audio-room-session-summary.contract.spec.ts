import { ConfigService } from '@nestjs/config';
import { AudioRoomsService } from './audio-rooms.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { CentrifugoService } from '../chat/centrifugo.service';
import { TranscriptEgressService } from './transcript-egress.service';
import { NlpService } from '../nlp/nlp.service';
import { R2Service } from '../cloudflare-r2/r2.service';
import { ChatLlmService } from '../chat/chat-llm.service';
import type { AudioRoomRecord } from './interfaces/audio-room.interface';

interface SummaryHarnessOptions {
  llmResult?: string;
  llmError?: Error;
  fallbackSummary?: {
    summary: string;
    vocabulary: string[];
  };
}

function createConfigService(): ConfigService {
  return {
    get: vi.fn((key: string) => {
      if (key === 'LIVEKIT_URL') return 'https://test.livekit.cloud';
      if (key === 'LIVEKIT_API_KEY') return 'test-key';
      if (key === 'LIVEKIT_SECRET') return 'test-secret-value';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    }),
  } as unknown as ConfigService;
}

function createSummaryHarness(options: SummaryHarnessOptions = {}) {
  const room = {
    id: 'room-1',
    room_name: 'room-spanish-practice',
    title: 'Spanish practice',
    target_language: 'es',
    language_pair: 'en-es',
    topic_tag: 'conversation',
    host_id: 'host-1',
    is_video_stream: false,
    is_active: true,
    speakers: ['host-1'],
    raised_hands: [],
    listeners_count: 1,
    created_at: '2026-08-26T12:00:00.000Z',
  } as unknown as AudioRoomRecord;

  const roomQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: room, error: null }),
    update: vi.fn().mockReturnThis(),
  };
  const transcriptUpsert = vi.fn().mockResolvedValue({ error: null });
  const transcriptQuery = { upsert: transcriptUpsert };
  const from = vi.fn((table: string) => {
    if (table === 'audio_rooms') return roomQuery;
    if (table === 'audio_room_transcripts') return transcriptQuery;
    throw new Error(`Unexpected table ${table}`);
  });

  const stopEgress = vi
    .fn()
    .mockResolvedValue('https://media.example.test/rooms/room-1.webm');
  const generateTranscriptFromAudioUrl = vi
    .fn()
    .mockResolvedValue(
      'We practised greetings, travel plans, and ordering food.',
    );
  const fallbackSummary = options.fallbackSummary ?? {
    summary: '- Greetings\n- Travel plans',
    vocabulary: ['hola', 'viaje', 'comida'],
  };
  const generateSessionSummary = vi.fn().mockResolvedValue(fallbackSummary);
  const chatCompletion = options.llmError
    ? vi.fn().mockRejectedValue(options.llmError)
    : vi.fn().mockResolvedValue(
        options.llmResult ??
          JSON.stringify({
            summary: '- Greetings\n- Ordering food',
            vocabulary: ['hola', 'gracias', 'menú'],
          }),
      );
  const publish = vi.fn().mockResolvedValue(true);

  const service = new AudioRoomsService(
    createConfigService(),
    {
      getClient: vi.fn().mockReturnValue({ from }),
    } as unknown as SupabaseService,
    {} as UsersService,
    { publish } as unknown as CentrifugoService,
    {
      stopEgress,
      generateTranscriptFromAudioUrl,
    } as unknown as TranscriptEgressService,
    { generateSessionSummary } as unknown as NlpService,
    {} as R2Service,
    { chatCompletion } as unknown as ChatLlmService,
  );
  vi.spyOn(service, 'getRoom').mockResolvedValue(room);

  return {
    service,
    roomQuery,
    transcriptUpsert,
    stopEgress,
    generateTranscriptFromAudioUrl,
    generateSessionSummary,
    chatCompletion,
    publish,
  };
}

describe('Audio room archived session summary contract', () => {
  it('persists AI key topics and vocabulary with the archived recording', async () => {
    const harness = createSummaryHarness();

    await harness.service.archiveRoom('host-1', { room_id: 'room-1' });

    expect(harness.stopEgress).toHaveBeenCalledWith('room-spanish-practice');
    expect(harness.generateTranscriptFromAudioUrl).toHaveBeenCalledWith(
      'https://media.example.test/rooms/room-1.webm',
    );
    expect(harness.chatCompletion).toHaveBeenCalledOnce();
    expect(harness.transcriptUpsert).toHaveBeenCalledWith(
      {
        room_id: 'room-1',
        recording_url: 'https://media.example.test/rooms/room-1.webm',
        transcript_text:
          'We practised greetings, travel plans, and ordering food.',
        session_summary: '- Greetings\n- Ordering food',
        vocabulary_list: ['hola', 'gracias', 'menú'],
      },
      { onConflict: 'room_id' },
    );
    expect(harness.roomQuery.update).toHaveBeenCalledWith({
      is_active: false,
      recording_url: 'https://media.example.test/rooms/room-1.webm',
    });
    expect(harness.publish).toHaveBeenCalledWith('room_room-1', {
      type: 'room_ended',
      room_id: 'room-1',
      recording_url: 'https://media.example.test/rooms/room-1.webm',
    });
  });

  it('falls back to the local NLP summary when the LLM is unavailable', async () => {
    const fallbackSummary = {
      summary: '- Greetings\n- Travel plans',
      vocabulary: ['hola', 'viaje', 'comida'],
    };
    const harness = createSummaryHarness({
      llmError: new Error('provider unavailable'),
      fallbackSummary,
    });

    await harness.service.archiveRoom('host-1', { room_id: 'room-1' });

    expect(harness.generateSessionSummary).toHaveBeenCalledWith(
      'We practised greetings, travel plans, and ordering food.',
    );
    expect(harness.transcriptUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        session_summary: fallbackSummary.summary,
        vocabulary_list: fallbackSummary.vocabulary,
      }),
      { onConflict: 'room_id' },
    );
  });

  it('returns the persisted summary and vocabulary through the transcript contract', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        recording_url: 'https://media.example.test/rooms/room-1.webm',
        transcript_text: 'Transcript text',
        session_summary: '- Greetings\n- Travel',
        vocabulary_list: ['hola', 'viaje'],
      },
      error: null,
    });
    const transcriptQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle,
    };
    const service = new AudioRoomsService(
      createConfigService(),
      {
        getClient: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue(transcriptQuery),
        }),
      } as unknown as SupabaseService,
      {} as UsersService,
      {} as CentrifugoService,
      {} as TranscriptEgressService,
      {} as NlpService,
      {} as R2Service,
      {} as ChatLlmService,
    );

    await expect(service.getTranscript('room-1')).resolves.toEqual({
      recording_url: 'https://media.example.test/rooms/room-1.webm',
      transcript_text: 'Transcript text',
      session_summary: '- Greetings\n- Travel',
      vocabulary: ['hola', 'viaje'],
    });
    expect(transcriptQuery.eq).toHaveBeenCalledWith('room_id', 'room-1');
    expect(transcriptQuery.limit).toHaveBeenCalledWith(1);
  });
});

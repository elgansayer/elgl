import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { describe, beforeEach, expect, it, vi } from 'vitest';
import { SupabaseService } from '../supabase/supabase.service';
import { NlpService } from '../nlp/nlp.service';
import { ChatLlmService } from '../chat/chat-llm.service';
import { TranscriptEgressService } from './transcript-egress.service';
import { AudioRoomArchivesService } from './audio-room-archives.service';

interface QueryBuilderMock {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

function queryBuilder(): QueryBuilderMock {
  const query: QueryBuilderMock = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    in: vi.fn(),
    lt: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    upsert: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };
  for (const method of [
    query.select,
    query.eq,
    query.neq,
    query.in,
    query.lt,
    query.order,
    query.limit,
    query.update,
    query.insert,
    query.upsert,
  ]) {
    method.mockReturnValue(query);
  }
  return query;
}

describe('AudioRoomArchivesService', () => {
  let service: AudioRoomArchivesService;
  let audioRooms: QueryBuilderMock;
  let participants: QueryBuilderMock;
  let transcripts: QueryBuilderMock;
  let captions: QueryBuilderMock;
  let chatCompletion: ReturnType<typeof vi.fn>;
  let generateSessionSummary: ReturnType<typeof vi.fn>;

  const room = {
    id: 'room-1',
    room_name: 'room-room-1',
    title: 'Practice',
    language_pair: 'en-ja',
    topic_tag: 'travel',
    host_id: 'host-1',
    co_host_id: null,
    speakers: [],
    invited_user_ids: [],
    is_private: false,
    is_active: false,
    recording_url: 'https://media.example.test/room-1.mp3',
    created_at: '2026-08-20T12:00:00.000Z',
  };

  beforeEach(async () => {
    audioRooms = queryBuilder();
    participants = queryBuilder();
    transcripts = queryBuilder();
    captions = queryBuilder();
    audioRooms.single.mockResolvedValue({ data: room, error: null });
    participants.maybeSingle.mockResolvedValue({ data: null, error: null });
    participants.upsert.mockReturnValue(participants);
    transcripts.maybeSingle.mockResolvedValue({ data: null, error: null });
    captions.limit.mockResolvedValue({ data: [], error: null });

    const supabaseClient = {
      from: vi.fn((table: string) => {
        if (table === 'audio_rooms') return audioRooms;
        if (table === 'audio_room_participants') return participants;
        if (table === 'audio_room_transcripts') return transcripts;
        if (table === 'audio_room_captions') return captions;
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    chatCompletion = vi.fn().mockResolvedValue(
      JSON.stringify({
        summary: '• Travel planning',
        vocabulary: ['ticket', 'platform'],
      }),
    );
    generateSessionSummary = vi.fn().mockResolvedValue({
      summary: '• Local fallback',
      vocabulary: ['fallback'],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AudioRoomArchivesService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              if (key === 'AUDIO_ROOM_SUMMARY_MAX_ATTEMPTS') return '4';
              if (key === 'AUDIO_ROOM_SUMMARY_MAX_TRANSCRIPT_CHARS')
                return '8000';
              if (key === 'AUDIO_ROOM_SUMMARY_CHUNK_CHARS') return '1000';
              return undefined;
            }),
          },
        },
        {
          provide: SupabaseService,
          useValue: { getClient: vi.fn().mockReturnValue(supabaseClient) },
        },
        {
          provide: TranscriptEgressService,
          useValue: {
            stopEgress: vi.fn().mockResolvedValue(room.recording_url),
            generateTranscriptFromAudioUrl: vi.fn().mockResolvedValue(''),
          },
        },
        {
          provide: ChatLlmService,
          useValue: { chatCompletion },
        },
        {
          provide: NlpService,
          useValue: { generateSessionSummary },
        },
      ],
    }).compile();

    service = module.get(AudioRoomArchivesService);
  });

  it('denies archived transcript access to non-participants', async () => {
    await expect(
      service.assertCanAccess('stranger-1', room.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not grant archive access merely because a user was invited', async () => {
    audioRooms.single.mockResolvedValue({
      data: { ...room, invited_user_ids: ['invited-1'] },
      error: null,
    });

    await expect(
      service.assertCanAccess('invited-1', room.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an authenticated recorded participant to read the archive', async () => {
    participants.maybeSingle.mockResolvedValue({
      data: { room_id: room.id },
      error: null,
    });

    await expect(
      service.assertCanAccess('participant-1', room.id),
    ).resolves.toBeUndefined();
  });

  it('chunks long transcripts and aggregates bounded summary vocabulary', async () => {
    const generateSummary = service['generateSummary'].bind(service);
    const result = await generateSummary('x'.repeat(3500));

    expect(chatCompletion).toHaveBeenCalledTimes(4);
    expect(result.summary).toContain('Travel planning');
    expect(result.vocabulary).toEqual(['ticket', 'platform']);
  });

  it('awaits the local NLP fallback if every LLM chunk fails', async () => {
    chatCompletion.mockRejectedValue(new Error('provider unavailable'));
    const generateSummary = service['generateSummary'].bind(service);

    const result = await generateSummary('fallback transcript');

    expect(generateSessionSummary).toHaveBeenCalledWith('fallback transcript');
    expect(result).toEqual({
      summary: '• Local fallback',
      vocabulary: ['fallback'],
    });
  });

  it('resets retry metadata and schedules processing for a host retry', async () => {
    const processSpy = vi.spyOn(service, 'processRoom').mockResolvedValue();
    transcripts.maybeSingle
      .mockResolvedValueOnce({
        data: {
          room_id: room.id,
          recording_url: room.recording_url,
          transcript_text: null,
          session_summary: null,
          vocabulary_list: [],
          summary_status: 'failed',
          summary_attempts: 2,
          summary_last_attempt_at: room.created_at,
          summary_next_retry_at: null,
          updated_at: room.created_at,
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: { room_id: room.id }, error: null });

    await service.retrySummary('host-1', room.id);

    expect(transcripts.update).toHaveBeenCalledWith(
      expect.objectContaining({
        summary_status: 'pending',
        summary_attempts: 0,
        summary_error_code: null,
      }),
    );
    expect(processSpy).toHaveBeenCalledWith(room.id);
  });

  it('does not reset a ready summary through the retry endpoint', async () => {
    transcripts.maybeSingle.mockResolvedValueOnce({
      data: {
        room_id: room.id,
        recording_url: room.recording_url,
        transcript_text: 'A transcript',
        session_summary: 'A summary',
        vocabulary_list: [],
        summary_status: 'ready',
        summary_attempts: 1,
        summary_last_attempt_at: room.created_at,
        summary_next_retry_at: null,
        updated_at: room.created_at,
      },
      error: null,
    });

    await expect(service.retrySummary('host-1', room.id)).rejects.toThrow(
      'Only a failed summary can be retried',
    );
    expect(transcripts.update).not.toHaveBeenCalled();
  });

  it('stops when another worker wins the optimistic summary claim', async () => {
    transcripts.maybeSingle
      .mockResolvedValueOnce({
        data: {
          room_id: room.id,
          recording_url: room.recording_url,
          transcript_text: 'A transcript',
          session_summary: null,
          vocabulary_list: [],
          summary_status: 'pending',
          summary_attempts: 0,
          summary_last_attempt_at: null,
          summary_next_retry_at: null,
          updated_at: room.created_at,
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });

    await service.processRoom(room.id);

    expect(transcripts.eq).toHaveBeenCalledWith('summary_status', 'pending');
    expect(transcripts.eq).toHaveBeenCalledWith('summary_attempts', 0);
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it('guards completion writes with the claimed attempt', async () => {
    await service['markReady'](room.id, 3, 'Transcript', 'Summary', ['word']);

    expect(transcripts.eq).toHaveBeenCalledWith('summary_status', 'processing');
    expect(transcripts.eq).toHaveBeenCalledWith('summary_attempts', 3);
  });
});

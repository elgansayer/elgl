import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudflareStreamService } from '../cloudflare-stream/cloudflare-stream.service';
import { MetricsService } from '../metrics/metrics.service';
import { ClassReplayRow, SupabaseService } from '../supabase/supabase.service';
import { ClassReplaysService } from './class-replays.service';

interface QueryBuilderMock {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

function queryBuilder(): QueryBuilderMock {
  const query: QueryBuilderMock = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    lt: vi.fn(),
    lte: vi.fn(),
    not: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };
  for (const method of [
    query.select,
    query.eq,
    query.in,
    query.lt,
    query.lte,
    query.not,
    query.or,
    query.order,
    query.limit,
    query.update,
    query.insert,
    query.delete,
  ]) {
    method.mockReturnValue(query);
  }
  return query;
}

function replayRow(overrides: Partial<ClassReplayRow> = {}): ClassReplayRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    host_id: 'host-1',
    room_id: null,
    title: 'Travel phrases',
    description: null,
    status: 'pending',
    provider: 'cloudflare_stream',
    provider_video_id: null,
    source_url: 'https://media.example.test/class.mp4',
    hls_url: null,
    dash_url: null,
    download_url: null,
    thumbnail_url: null,
    duration_seconds: null,
    failure_code: null,
    attempts: 0,
    next_attempt_at: '2026-11-11T08:00:00.000Z',
    last_attempt_at: null,
    ready_at: null,
    expires_at: null,
    created_at: '2026-11-11T08:00:00.000Z',
    updated_at: '2026-11-11T08:00:00.000Z',
    ...overrides,
  };
}

describe('ClassReplaysService', () => {
  let service: ClassReplaysService;
  let classReplays: QueryBuilderMock;
  let audioRooms: QueryBuilderMock;
  let participants: QueryBuilderMock;
  let cloudflare: {
    copyVideoFromUrl: Mock;
    getVideoPlayback: Mock;
    waitForDefaultDownload: Mock;
    deleteVideo: Mock;
  };
  let metrics: {
    recordClassReplayCreated: Mock;
    recordClassReplayTransition: Mock;
    recordClassReplayProcessing: Mock;
    recordClassReplayPurged: Mock;
  };

  beforeEach(async () => {
    classReplays = queryBuilder();
    audioRooms = queryBuilder();
    participants = queryBuilder();
    audioRooms.maybeSingle.mockResolvedValue({
      data: {
        id: 'room-1',
        title: 'Travel class',
        host_id: 'host-1',
        co_host_id: null,
        speakers: ['host-1'],
      },
      error: null,
    });
    participants.maybeSingle.mockResolvedValue({ data: null, error: null });

    const supabaseClient = {
      from: vi.fn((table: string) => {
        if (table === 'class_replays') return classReplays;
        if (table === 'audio_rooms') return audioRooms;
        if (table === 'audio_room_participants') return participants;
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    cloudflare = {
      copyVideoFromUrl: vi.fn().mockResolvedValue('video-1'),
      getVideoPlayback: vi.fn(),
      waitForDefaultDownload: vi
        .fn()
        .mockResolvedValue('https://media.example.test/replay.mp4'),
      deleteVideo: vi.fn().mockResolvedValue(undefined),
    };
    metrics = {
      recordClassReplayCreated: vi.fn(),
      recordClassReplayTransition: vi.fn(),
      recordClassReplayProcessing: vi.fn(),
      recordClassReplayPurged: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassReplaysService,
        {
          provide: ConfigService,
          useValue: { get: vi.fn(() => undefined) },
        },
        {
          provide: SupabaseService,
          useValue: { getClient: vi.fn().mockReturnValue(supabaseClient) },
        },
        { provide: CloudflareStreamService, useValue: cloudflare },
        { provide: MetricsService, useValue: metrics },
      ],
    }).compile();

    service = module.get(ClassReplaysService);
  });

  it('rejects a replay when the caller is not the classroom host or co-host', async () => {
    await expect(
      service.createReplay('stranger-1', {
        roomId: 'room-1',
        title: 'Travel phrases',
        sourceUrl: 'https://media.example.test/class.mp4',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a source recording that is not a credential-free HTTPS URL', async () => {
    await expect(
      service.createReplay('host-1', {
        roomId: 'room-1',
        title: 'Travel phrases',
        sourceUrl: 'http://media.example.test/class.mp4',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('registers a pending replay and schedules transcoding', async () => {
    const processSpy = vi
      .spyOn(service, 'processReplay')
      .mockResolvedValue(undefined);
    classReplays.single.mockResolvedValue({
      data: replayRow(),
      error: null,
    });

    const replay = await service.createReplay('host-1', {
      roomId: 'room-1',
      title: 'Travel phrases',
      sourceUrl: 'https://media.example.test/class.mp4',
    });

    expect(replay.status).toBe('pending');
    expect(replay.title).toBe('Travel phrases');
    expect(metrics.recordClassReplayCreated).toHaveBeenCalledWith('manual');
    expect(processSpy).toHaveBeenCalledWith(replay.id);
  });

  it('returns a conflict instead of an empty player while a replay is pending', async () => {
    classReplays.maybeSingle.mockResolvedValue({
      data: replayRow(),
      error: null,
    });

    await expect(
      service.getPlayback('host-1', replayRow().id),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns adaptive sources only to an authorised participant', async () => {
    classReplays.maybeSingle.mockResolvedValue({
      data: replayRow({
        status: 'ready',
        hls_url: 'https://media.example.test/replay.m3u8',
        dash_url: 'https://media.example.test/replay.mpd',
      }),
      error: null,
    });

    const playback = await service.getPlayback('host-1', replayRow().id);

    expect(playback.hls_url).toContain('.m3u8');
    expect(playback.dash_url).toContain('.mpd');
  });

  it('copies a source recording once and schedules the first poll', async () => {
    const row = replayRow();
    classReplays.maybeSingle
      .mockResolvedValueOnce({ data: row, error: null })
      .mockResolvedValueOnce({ data: { id: row.id }, error: null });
    classReplays.update.mockReturnValue(classReplays);

    await service.processReplay(row.id);

    expect(cloudflare.copyVideoFromUrl).toHaveBeenCalledWith(
      'https://media.example.test/class.mp4',
      expect.objectContaining({ name: 'Travel phrases' }),
    );
    expect(classReplays.update).toHaveBeenCalledWith(
      expect.objectContaining({
        provider_video_id: 'video-1',
        status: 'processing',
      }),
    );
  });

  it('marks a replay ready with HLS, DASH and progressive fallback sources', async () => {
    const row = replayRow({
      provider_video_id: 'video-1',
      status: 'processing',
      attempts: 0,
    });
    classReplays.maybeSingle
      .mockResolvedValueOnce({ data: row, error: null })
      .mockResolvedValueOnce({ data: { id: row.id }, error: null });
    cloudflare.getVideoPlayback.mockResolvedValue({
      videoId: 'video-1',
      ready: true,
      state: 'ready',
      hlsUrl: 'https://media.example.test/replay.m3u8',
      dashUrl: 'https://media.example.test/replay.mpd',
      thumbnailUrl: 'https://media.example.test/thumb.jpg',
      durationSeconds: 125,
    });

    await service.processReplay(row.id);

    expect(cloudflare.waitForDefaultDownload).toHaveBeenCalled();
    expect(classReplays.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ready',
        hls_url: 'https://media.example.test/replay.m3u8',
        dash_url: 'https://media.example.test/replay.mpd',
        download_url: 'https://media.example.test/replay.mp4',
        duration_seconds: 125,
      }),
    );
    expect(metrics.recordClassReplayTransition).toHaveBeenCalledWith('ready');
  });

  it('only the host can retry a failed replay', async () => {
    classReplays.maybeSingle.mockResolvedValue({
      data: replayRow({ status: 'failed', attempts: 3 }),
      error: null,
    });

    await expect(
      service.retry('stranger-1', replayRow().id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses to retry a replay that has not failed', async () => {
    classReplays.maybeSingle.mockResolvedValue({
      data: replayRow({ status: 'ready', attempts: 1 }),
      error: null,
    });

    await expect(
      service.retry('host-1', replayRow().id),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('erases a learner replay and its provider recording', async () => {
    classReplays.limit.mockResolvedValue({
      data: [{ id: replayRow().id, provider_video_id: 'video-1' }],
      error: null,
    });

    await service.deleteReplaysForUser('host-1');

    expect(cloudflare.deleteVideo).toHaveBeenCalledWith('video-1');
    expect(classReplays.delete).toHaveBeenCalled();
  });

  it('purges expired replays and their provider recordings', async () => {
    classReplays.limit.mockResolvedValue({
      data: [{ id: replayRow().id, provider_video_id: 'video-1' }],
      error: null,
    });
    classReplays.eq.mockResolvedValue({ error: null });

    await service.purgeExpiredReplays();

    expect(cloudflare.deleteVideo).toHaveBeenCalledWith('video-1');
    expect(metrics.recordClassReplayPurged).toHaveBeenCalled();
  });
});

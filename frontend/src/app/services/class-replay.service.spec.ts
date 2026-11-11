import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from './api.service';
import {
  ClassReplay,
  ClassReplayPlayback,
  ClassReplayService,
} from './class-replay.service';

const replay: ClassReplay = {
  id: 'replay-1',
  host_id: 'host-1',
  room_id: 'room-1',
  title: 'Travel phrases',
  description: null,
  status: 'ready',
  hls_url: 'https://media.example.test/replay.m3u8',
  dash_url: 'https://media.example.test/replay.mpd',
  download_url: 'https://media.example.test/replay.mp4',
  thumbnail_url: null,
  duration_seconds: 60,
  failure_code: null,
  ready_at: '2026-11-11T08:00:00.000Z',
  expires_at: null,
  created_at: '2026-11-11T08:00:00.000Z',
  updated_at: '2026-11-11T08:00:00.000Z',
};

const playback: ClassReplayPlayback = {
  replay_id: replay.id,
  status: 'ready',
  hls_url: replay.hls_url,
  dash_url: replay.dash_url,
  download_url: replay.download_url,
  thumbnail_url: null,
  duration_seconds: 60,
  expires_at: null,
};

describe('ClassReplayService', () => {
  let service: ClassReplayService;
  const api = {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        ClassReplayService,
        { provide: ApiService, useValue: api },
      ],
    });
    service = TestBed.inject(ClassReplayService);
  });

  it('loads replays through the authenticated API with an optional room filter', async () => {
    api.get.mockResolvedValue([replay]);

    await expect(service.listReplays('room-1')).resolves.toEqual([replay]);
    expect(api.get).toHaveBeenCalledWith(
      expect.stringContaining('/class-replays'),
      expect.objectContaining({ params: { roomId: 'room-1' }, fallback: [] }),
    );
  });

  it('normalises a malformed listing into an empty collection', async () => {
    api.get.mockResolvedValue({ unexpected: true });

    await expect(service.listReplays()).resolves.toEqual([]);
  });

  it('resolves playback sources by encoded replay id', async () => {
    api.get.mockResolvedValue(playback);

    await expect(service.getPlayback('replay / 1')).resolves.toEqual(playback);
    expect(api.get).toHaveBeenCalledWith(
      expect.stringContaining('/class-replays/replay%20%2F%201/playback'),
    );
  });

  it('retries and deletes by encoded replay id', async () => {
    api.post.mockResolvedValue({ queued: true });
    api.delete.mockResolvedValue(undefined);

    await service.retryReplay('replay-1');
    await service.deleteReplay('replay-1');

    expect(api.post).toHaveBeenCalledWith(
      expect.stringContaining('/class-replays/replay-1/retry'),
      {},
    );
    expect(api.delete).toHaveBeenCalledWith(
      expect.stringContaining('/class-replays/replay-1'),
    );
  });
});

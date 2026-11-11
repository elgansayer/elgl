import type { Mock } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { CloudflareStreamService } from './cloudflare-stream.service';

const CONFIG: Record<string, string> = {
  CLOUDFLARE_STREAM_ACCOUNT_ID: 'account-123',
  CLOUDFLARE_STREAM_API_TOKEN: 'test-cloudflare-stream-api-token',
  CLOUDFLARE_STREAM_ALLOWED_ORIGINS:
    'https://app.example.com,https://admin.example.com',
  CLOUDFLARE_STREAM_POLL_INTERVAL_MS: '1',
  CLOUDFLARE_STREAM_RECORDING_TIMEOUT_MS: '5000',
  CLOUDFLARE_STREAM_DELETE_RECORDING_AFTER_DAYS: '1',
};

function apiResponse(result: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({ success: status >= 200 && status < 300, result }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

describe('CloudflareStreamService', () => {
  let service: CloudflareStreamService;
  let fetchMock: Mock;

  beforeEach(async () => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloudflareStreamService,
        {
          provide: ConfigService,
          useValue: { get: vi.fn((key: string) => CONFIG[key]) },
        },
      ],
    }).compile();
    service = module.get<CloudflareStreamService>(CloudflareStreamService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a short-lived automatic Cloudflare Stream live input', async () => {
    fetchMock.mockResolvedValue(
      apiResponse({
        uid: 'input-123',
        rtmps: {
          url: 'rtmps://live.cloudflare.com:443/live',
          streamKey: 'secret-stream-key',
        },
      }),
    );

    const input = await service.createLiveInput('room-1');

    expect(input).toEqual({
      inputId: 'input-123',
      rtmpsUrl: 'rtmps://live.cloudflare.com:443/live/secret-stream-key',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/account-123/stream/live_inputs',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${CONFIG.CLOUDFLARE_STREAM_API_TOKEN}`,
        }),
      }),
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      recording: {
        mode: 'automatic',
        requireSignedURLs: false,
        allowedOrigins: [
          'https://app.example.com',
          'https://admin.example.com',
        ],
      },
      deleteRecordingAfterDays: 1,
    });
  });

  it('waits for a recording and its audio-only download', async () => {
    fetchMock
      .mockResolvedValueOnce(
        apiResponse([
          {
            uid: 'video-123',
            readyToStream: true,
            status: { state: 'ready' },
            playback: {
              hls: 'https://stream.example/video-123/manifest.m3u8',
              dash: 'https://stream.example/video-123/manifest.mpd',
            },
            thumbnail: 'https://stream.example/video-123/thumb.jpg',
            duration: 90,
          },
        ]),
      )
      .mockResolvedValueOnce(
        apiResponse({
          audio: { status: 'inprogress', url: '' },
        }),
      )
      .mockResolvedValueOnce(
        apiResponse({
          audio: {
            status: 'ready',
            url: 'https://stream.example/video-123/audio.m4a',
          },
        }),
      );

    const recording = await service.waitForRecording('input-123');

    expect(recording).toEqual({
      videoId: 'video-123',
      playbackUrl: 'https://stream.example/video-123/manifest.m3u8',
      dashUrl: 'https://stream.example/video-123/manifest.mpd',
      thumbnailUrl: 'https://stream.example/video-123/thumb.jpg',
      durationSeconds: 90,
      audioDownloadUrl: 'https://stream.example/video-123/audio.m4a',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.cloudflare.com/client/v4/accounts/account-123/stream/video-123/downloads/audio',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('deletes a short-lived live input through a least-privilege API token', async () => {
    fetchMock.mockResolvedValue(apiResponse({}));

    await service.deleteLiveInput('input-123');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/account-123/stream/live_inputs/input-123',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('copies a recording for on-the-fly adaptive transcoding', async () => {
    fetchMock.mockResolvedValue(apiResponse({ uid: 'video-456' }));

    const videoId = await service.copyVideoFromUrl(
      'https://media.example.com/class.mp4',
      { name: 'Travel class', roomId: 'room-1' },
    );

    expect(videoId).toBe('video-456');
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.cloudflare.com/client/v4/accounts/account-123/stream/copy',
    );
    expect(JSON.parse(String(request.body))).toMatchObject({
      url: 'https://media.example.com/class.mp4',
      meta: { name: 'Travel class', roomId: 'room-1' },
      requireSignedURLs: false,
    });
  });

  it('rejects non-HTTPS or private source recordings before copying', async () => {
    await expect(
      service.copyVideoFromUrl('http://media.example.com/class.mp4', {
        name: 'Travel class',
      }),
    ).rejects.toThrow('must use HTTPS');
    await expect(
      service.copyVideoFromUrl('https://127.0.0.1/class.mp4', {
        name: 'Travel class',
      }),
    ).rejects.toThrow('must be publicly reachable');
    await expect(
      service.copyVideoFromUrl('https://[::ffff:127.0.0.1]/class.mp4', {
        name: 'Travel class',
      }),
    ).rejects.toThrow('must be publicly reachable');
    await expect(
      service.copyVideoFromUrl('https://[::ffff:10.0.0.1]/class.mp4', {
        name: 'Travel class',
      }),
    ).rejects.toThrow('must be publicly reachable');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns adaptive playback sources and readiness state', async () => {
    fetchMock.mockResolvedValue(
      apiResponse({
        uid: 'video-456',
        readyToStream: true,
        status: { state: 'ready' },
        playback: {
          hls: 'https://stream.example/video-456/manifest.m3u8',
          dash: 'https://stream.example/video-456/manifest.mpd',
        },
        thumbnail: 'https://stream.example/video-456/thumb.jpg',
        duration: 120,
      }),
    );

    await expect(service.getVideoPlayback('video-456')).resolves.toEqual({
      videoId: 'video-456',
      ready: true,
      state: 'ready',
      hlsUrl: 'https://stream.example/video-456/manifest.m3u8',
      dashUrl: 'https://stream.example/video-456/manifest.mpd',
      thumbnailUrl: 'https://stream.example/video-456/thumb.jpg',
      durationSeconds: 120,
    });
  });

  it('deletes a replay provider recording', async () => {
    fetchMock.mockResolvedValue(apiResponse({}));

    await service.deleteVideo('video-456');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/account-123/stream/video-456',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('waits for the progressive MP4 derivative', async () => {
    fetchMock
      .mockResolvedValueOnce(apiResponse({}))
      .mockResolvedValueOnce(
        apiResponse({
          default: { status: 'inprogress', url: '' },
        }),
      )
      .mockResolvedValueOnce(
        apiResponse({
          default: {
            status: 'ready',
            url: 'https://stream.example/video-456/download.mp4',
          },
        }),
      );

    await expect(service.waitForDefaultDownload('video-456')).resolves.toBe(
      'https://stream.example/video-456/download.mp4',
    );
  });

  it('rejects malformed identifiers before making an API request', async () => {
    await expect(service.waitForRecording('../input')).rejects.toThrow(
      'live input ID is invalid',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces Cloudflare API failures without returning a fake recording', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          errors: [{ message: 'Stream quota exceeded' }],
          result: null,
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(service.createLiveInput('room-1')).rejects.toThrow(
      'Stream quota exceeded',
    );
  });
});

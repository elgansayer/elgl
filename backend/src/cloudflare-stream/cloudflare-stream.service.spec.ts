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
            playback: { hls: 'https://stream.example/video-123/manifest.m3u8' },
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

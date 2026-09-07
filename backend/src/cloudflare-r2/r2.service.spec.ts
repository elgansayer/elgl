import { createHmac } from 'node:crypto';
import type { Mock } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { R2Service } from './r2.service';

const CONFIG: Record<string, string> = {
  CLOUDFLARE_R2_GATEWAY_URL: 'https://gateway.example.workers.dev',
  CLOUDFLARE_R2_PUBLIC_URL: 'https://media.example.com',
  CLOUDFLARE_R2_SIGNING_SECRET:
    'test-r2-signing-secret-with-at-least-32-characters',
  CLOUDFLARE_R2_SERVICE_TOKEN:
    'test-r2-service-token-with-at-least-32-characters',
  CLOUDFLARE_R2_UPLOAD_TTL_SECONDS: '3600',
  CLOUDFLARE_R2_MAX_SINGLE_UPLOAD_BYTES: '1024',
  CLOUDFLARE_R2_MAX_MULTIPART_PART_BYTES: '2048',
  CLOUDFLARE_R2_SOURCE_FETCH_TIMEOUT_MS: '5000',
  CLOUDFLARE_R2_SOURCE_HOSTS: 'recordings.example.com,*.livekit.example.com',
};

describe('R2Service', () => {
  let service: R2Service;
  let fetchMock: Mock;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-19T12:00:00.000Z'));
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        R2Service,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => CONFIG[key]),
          },
        },
      ],
    }).compile();
    service = module.get<R2Service>(R2Service);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('creates a bounded HMAC-signed Cloudflare Worker upload URL', async () => {
    const result = await service.generateUploadUrl(
      'voice note.webm',
      'audio/webm',
    );
    const url = new URL(result.uploadUrl);
    const key = decodeURIComponent(url.pathname.split('/').slice(3).join('/'));
    const expires = url.searchParams.get('expires');
    const maximumBytes = url.searchParams.get('maxBytes');
    const expectedPayload = [
      'cloudflare-r2-upload-v1',
      'PUT',
      key,
      expires,
      'audio/webm',
      maximumBytes,
      '',
      '',
    ].join('\n');
    const expectedSignature = createHmac(
      'sha256',
      CONFIG.CLOUDFLARE_R2_SIGNING_SECRET,
    )
      .update(expectedPayload)
      .digest('base64url');

    expect(url.origin).toBe('https://gateway.example.workers.dev');
    expect(key).toMatch(/^voice_notes\/[0-9a-f-]{36}_voice_note\.webm$/);
    expect(url.searchParams.get('contentType')).toBe('audio/webm');
    expect(maximumBytes).toBe('1024');
    expect(url.searchParams.get('signature')).toBe(expectedSignature);
    expect(result.publicUrl).toBe(`https://media.example.com/${key}`);
  });

  it('creates signed multipart part URLs bound to the key and part number', () => {
    const url = new URL(
      service.createMultipartPartUploadUrl(
        { key: 'recordings/session.webm', uploadId: 'upload-1' },
        2,
        1000,
      ),
    );

    expect(url.pathname).toBe('/v1/multipart/upload-1/parts/2');
    expect(url.searchParams.get('key')).toBe('recordings/session.webm');
    expect(url.searchParams.get('contentType')).toBe(
      'application/octet-stream',
    );
    expect(url.searchParams.get('maxBytes')).toBe('1000');
  });

  it('uploads an allowlisted external recording through the gateway', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: {
            'Content-Type': 'video/webm',
            'Content-Length': '3',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            key: 'recordings/session.webm',
            etag: 'etag',
            size: 3,
            uploadedAt: '2026-08-19T12:00:00.000Z',
            publicUrl: 'https://media.example.com/recordings/session.webm',
          }),
          {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    await expect(
      service.uploadFromUrl(
        'recordings/session.webm',
        'https://recordings.example.com/session.webm',
      ),
    ).resolves.toBe('https://media.example.com/recordings/session.webm');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      new URL('https://recordings.example.com/session.webm'),
      expect.objectContaining({ method: 'GET', redirect: 'manual' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('gateway.example.workers.dev/v1/objects/'),
      expect.objectContaining({
        method: 'PUT',
        headers: {
          'Content-Type': 'video/webm',
          'Content-Length': '3',
        },
      }),
    );
  });

  it('rejects private and non-allowlisted source URLs before fetching', async () => {
    await expect(
      service.uploadFromUrl('recordings/test.webm', 'http://127.0.0.1/test'),
    ).rejects.toThrow('private or local host');
    await expect(
      service.uploadFromUrl(
        'recordings/test.webm',
        'https://untrusted.example.com/test',
      ),
    ).rejects.toThrow('not allowlisted');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('authenticates management requests with the Worker service token', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: {
          'Content-Length': '42',
          ETag: '"etag"',
          'Content-Type': 'image/webp',
          'X-R2-Key': 'covers/user/cover.webp',
          'X-R2-Uploaded-At': '2026-08-19T12:00:00.000Z',
        },
      }),
    );

    await service.headObject('covers/user/cover.webp');

    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        'https://gateway.example.workers.dev/v1/objects/covers/user/cover.webp',
      ),
      expect.objectContaining({
        method: 'HEAD',
        headers: {
          Authorization: `Bearer ${CONFIG.CLOUDFLARE_R2_SERVICE_TOKEN}`,
        },
      }),
    );
  });
});

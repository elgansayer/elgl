import type { Mock } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { R2ObjectService } from './r2-object.service';
import { R2Service } from './r2.service';

const CONFIG: Record<string, string> = {
  CLOUDFLARE_R2_GATEWAY_URL: 'https://gateway.example.workers.dev',
  CLOUDFLARE_R2_PUBLIC_URL: 'https://media.example.com',
  CLOUDFLARE_R2_SERVICE_TOKEN:
    'test-r2-service-token-with-at-least-32-characters',
  CLOUDFLARE_R2_SOURCE_FETCH_TIMEOUT_MS: '5000',
  CLOUDFLARE_R2_MAX_SINGLE_UPLOAD_BYTES: '1024',
};

describe('R2ObjectService', () => {
  let service: R2ObjectService;
  let fetchMock: Mock;
  let r2Service: { createObjectUploadUrl: Mock; deleteObject: Mock };

  beforeEach(async () => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    r2Service = {
      createObjectUploadUrl: vi.fn().mockReturnValue({
        uploadUrl: 'https://gateway.example.workers.dev/signed-upload',
        publicUrl: 'https://media.example.com/covers/user/cover.webp',
      }),
      deleteObject: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        R2ObjectService,
        { provide: R2Service, useValue: r2Service },
        {
          provide: ConfigService,
          useValue: { get: vi.fn((key: string) => CONFIG[key]) },
        },
      ],
    }).compile();
    service = module.get<R2ObjectService>(R2ObjectService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uploads server-produced bytes through a signed Worker URL', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          key: 'covers/user/cover.webp',
          etag: 'etag',
          size: 3,
          uploadedAt: '2026-08-19T12:00:00.000Z',
          publicUrl: 'https://media.example.com/covers/user/cover.webp',
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await service.uploadBytes(
      'covers/user/cover.webp',
      'image/webp',
      new Uint8Array([1, 2, 3]),
    );

    expect(r2Service.createObjectUploadUrl).toHaveBeenCalledWith(
      'covers/user/cover.webp',
      'image/webp',
      3,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://gateway.example.workers.dev/signed-upload',
      expect.objectContaining({
        method: 'PUT',
        headers: {
          'Content-Type': 'image/webp',
          'Content-Length': '3',
        },
      }),
    );
    expect(result.publicUrl).toBe(
      'https://media.example.com/covers/user/cover.webp',
    );
  });

  it('downloads private object bytes with service authentication', async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([4, 5, 6]), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': '3',
          ETag: '"etag"',
        },
      }),
    );

    const object = await service.downloadObject('covers/user/cover.png');

    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        'https://gateway.example.workers.dev/v1/objects/covers/user/cover.png',
      ),
      expect.objectContaining({
        method: 'GET',
        headers: {
          Authorization: `Bearer ${CONFIG.CLOUDFLARE_R2_SERVICE_TOKEN}`,
        },
      }),
    );
    expect(Array.from(object.bytes)).toEqual([4, 5, 6]);
    expect(object.contentType).toBe('image/png');
  });

  it('rejects zero length and oversized server uploads', async () => {
    await expect(
      service.uploadBytes(
        'covers/user/empty.webp',
        'image/webp',
        new Uint8Array(),
      ),
    ).rejects.toThrow('outside the configured limits');
    await expect(
      service.uploadBytes(
        'covers/user/large.webp',
        'image/webp',
        new Uint8Array(1025),
      ),
    ).rejects.toThrow('outside the configured limits');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('delegates object deletion to the shared gateway service', async () => {
    await service.deleteObject('covers/user/cover.webp');
    expect(r2Service.deleteObject).toHaveBeenCalledWith(
      'covers/user/cover.webp',
    );
  });
});

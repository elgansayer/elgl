import type { Mock } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { R2ObjectService } from '../cloudflare-r2/r2-object.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AudioCompressionService } from './audio-compression.service';
import { ImageCompressionService } from './image-compression.service';
import { MediaService } from './media.service';

describe('MediaService', () => {
  let service: MediaService;
  let r2ObjectService: {
    createUploadUrl: Mock;
    uploadBytes: Mock;
    downloadObject: Mock;
  };
  let imageCompressionService: { compress: Mock };
  let usersUpdate: Mock;

  beforeEach(async () => {
    r2ObjectService = {
      createUploadUrl: vi.fn((key: string) => ({
        uploadUrl: `https://gateway.example.test/upload/${key}`,
        publicUrl: `https://media.example.test/${key}`,
      })),
      uploadBytes: vi.fn(
        (key: string, _contentType: string, bytes: Uint8Array) =>
          Promise.resolve({
            key,
            etag: 'etag',
            size: bytes.byteLength,
            uploadedAt: '2026-08-19T12:00:00.000Z',
            publicUrl: `https://media.example.test/${key}`,
          }),
      ),
      downloadObject: vi.fn().mockResolvedValue({
        bytes: new Uint8Array([1, 2, 3]),
        contentType: 'image/png',
        etag: 'etag',
      }),
    };
    imageCompressionService = {
      compress: vi.fn().mockResolvedValue(Buffer.from([4, 5, 6])),
    };
    usersUpdate = vi.fn();
    const usersEq = vi.fn().mockResolvedValue({ error: null });
    usersUpdate.mockReturnValue({ eq: usersEq });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: R2ObjectService, useValue: r2ObjectService },
        {
          provide: AudioCompressionService,
          useValue: {
            compressToOgg: vi.fn(),
            compressToM4a: vi.fn(),
          },
        },
        {
          provide: ImageCompressionService,
          useValue: imageCompressionService,
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue({ update: usersUpdate }),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generatePresignedUrl', () => {
    it('uses the Cloudflare gateway and returns a public media URL', async () => {
      const result = await service.generatePresignedUrl('user-1', {
        filename: 'my-avatar.png',
        folder: 'avatars',
        contentType: 'image/png',
      });

      expect(result.objectKey).toMatch(
        /^avatars\/user-1\/\d+-[a-f0-9]{16}\.png$/,
      );
      expect(r2ObjectService.createUploadUrl).toHaveBeenCalledWith(
        result.objectKey,
        'image/png',
      );
      expect(result).toEqual({
        uploadUrl: `https://gateway.example.test/upload/${result.objectKey}`,
        mediaUrl: `https://media.example.test/${result.objectKey}`,
        objectKey: result.objectKey,
      });
    });

    it('uses the bin extension when the supplied extension is empty', async () => {
      const result = await service.generatePresignedUrl('user-1', {
        filename: 'filewithoutdot.',
        folder: 'audio-intros',
        contentType: 'application/octet-stream',
      });

      expect(result.objectKey).toMatch(/\.bin$/);
    });
  });

  describe('dedicated presigned uploads', () => {
    it('creates avatar uploads only in the authenticated users avatar prefix', async () => {
      const result = await service.generateAvatarPresignedUrl('user-1', {
        filename: 'profile.webp',
        contentType: 'image/webp',
      });

      expect(result.objectKey).toMatch(
        /^avatars\/user-1\/\d+-[a-f0-9]{16}\.webp$/,
      );
      expect(r2ObjectService.createUploadUrl).toHaveBeenCalledWith(
        result.objectKey,
        'image/webp',
      );
    });

    it('creates audio intro uploads only in the authenticated users audio prefix', async () => {
      const result = await service.generateAudioIntroPresignedUrl('user-1', {
        filename: 'hello.m4a',
        contentType: 'audio/mp4',
      });

      expect(result.objectKey).toMatch(
        /^audio-intros\/user-1\/\d+-[a-f0-9]{16}\.m4a$/,
      );
      expect(r2ObjectService.createUploadUrl).toHaveBeenCalledWith(
        result.objectKey,
        'audio/mp4',
      );
    });

    it('rejects unsupported avatar types before issuing an upload URL', async () => {
      await expect(
        service.generateAvatarPresignedUrl('user-1', {
          filename: 'avatar.svg',
          contentType: 'image/svg+xml',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(r2ObjectService.createUploadUrl).not.toHaveBeenCalled();
    });

    it('rejects unsupported audio intro types before issuing an upload URL', async () => {
      await expect(
        service.generateAudioIntroPresignedUrl('user-1', {
          filename: 'intro.exe',
          contentType: 'application/octet-stream',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(r2ObjectService.createUploadUrl).not.toHaveBeenCalled();
    });
  });

  it('downloads, compresses and overwrites a confirmed cover through the gateway', async () => {
    const result = await service.confirmCoverUpload(
      'user-1',
      'covers/user-1/cover.png',
    );

    expect(r2ObjectService.downloadObject).toHaveBeenCalledWith(
      'covers/user-1/cover.png',
    );
    expect(imageCompressionService.compress).toHaveBeenCalledWith(
      Buffer.from([1, 2, 3]),
      'image/png',
    );
    expect(r2ObjectService.uploadBytes).toHaveBeenCalledWith(
      'covers/user-1/cover.png',
      'image/png',
      Buffer.from([4, 5, 6]),
    );
    expect(usersUpdate).toHaveBeenCalledWith({
      cover_url: 'https://media.example.test/covers/user-1/cover.png',
    });
    expect(result).toEqual({
      coverUrl: 'https://media.example.test/covers/user-1/cover.png',
    });
  });

  it('uploads compressed avatar bytes without an AWS client', async () => {
    const file = {
      buffer: Buffer.from([1, 2, 3]),
      mimetype: 'image/png',
      originalname: 'avatar.png',
    } as Express.Multer.File;

    const result = await service.uploadAndSetAvatarImage('user-1', file);

    expect(imageCompressionService.compress).toHaveBeenCalledWith(
      file.buffer,
      'image/png',
    );
    expect(r2ObjectService.uploadBytes).toHaveBeenCalledWith(
      expect.stringMatching(/^avatars\/user-1\/\d+-[a-f0-9]{16}\.png$/),
      'image/png',
      Buffer.from([4, 5, 6]),
    );
    expect(result.avatarUrl).toMatch(
      /^https:\/\/media\.example\.test\/avatars\/user-1\/\d+-[a-f0-9]{16}\.png$/,
    );
  });
});

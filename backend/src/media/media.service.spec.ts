import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MediaService } from './media.service';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  PutObjectCommand: jest.fn().mockImplementation((args) => args),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://upload.r2.mock/url'),
}));

describe('MediaService', () => {
  let service: MediaService;

  beforeEach(async () => {
    (S3Client as unknown as jest.Mock).mockClear();
    (PutObjectCommand as unknown as jest.Mock).mockClear();
    (getSignedUrl as jest.Mock)
      .mockClear()
      .mockResolvedValue('https://upload.r2.mock/url');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'CLOUDFLARE_R2_ENDPOINT')
                return 'https://r2.cloudflare.mock';
              if (key === 'CLOUDFLARE_R2_ACCESS_KEY_ID') return 'mock-key-id';
              if (key === 'CLOUDFLARE_R2_SECRET_ACCESS_KEY')
                return 'mock-secret-key';
              if (key === 'CLOUDFLARE_R2_BUCKET') return 'hellotalk-media';
              if (key === 'CLOUDFLARE_R2_PUBLIC_DOMAIN')
                return 'https://media.hellotalk.mock';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
    service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialise S3Client with Cloudflare R2 credentials from config', () => {
      expect(S3Client).toHaveBeenCalledWith({
        region: 'auto',
        endpoint: 'https://r2.cloudflare.mock',
        credentials: {
          accessKeyId: 'mock-key-id',
          secretAccessKey: 'mock-secret-key',
        },
      });
    });
  });

  describe('generatePresignedUrl', () => {
    it('should generate object key and return presigned upload URL and media URL', async () => {
      const dto = {
        filename: 'my-avatar.png',
        folder: 'avatars',
        contentType: 'image/png',
      };

      const result = await service.generatePresignedUrl('user-1', dto);

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'hellotalk-media',
          Key: expect.stringMatching(
            /^avatars\/user-1\/\d+-[a-f0-9]{16}\.png$/,
          ),
          ContentType: 'image/png',
        }),
      );
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        { expiresIn: 3600 },
      );
      expect(result).toEqual({
        uploadUrl: 'https://upload.r2.mock/url',
        mediaUrl: expect.stringMatching(
          /^https:\/\/media\.hellotalk\.mock\/avatars\/user-1\/\d+-[a-f0-9]{16}\.png$/,
        ),
        objectKey: expect.stringMatching(
          /^avatars\/user-1\/\d+-[a-f0-9]{16}\.png$/,
        ),
      });
    });

    it('should use default bin extension if filename pop returns empty string', async () => {
      const dto = {
        filename: 'filewithoutdot.',
        folder: 'audio',
        contentType: 'application/octet-stream',
      };

      const result = await service.generatePresignedUrl('user-1', dto);

      expect(result.objectKey).toMatch(/\.bin$/);
    });
  });
});

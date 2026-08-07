import { Test, TestingModule } from '@nestjs/testing';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('MediaController', () => {
  let controller: MediaController;
  let mediaService: MediaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        {
          provide: MediaService,
          useValue: {
            generateCoverPresignedUrl: jest.fn(),
            confirmCoverUpload: jest.fn(),
            uploadAndCompressVoiceNote: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<MediaController>(MediaController);
    mediaService = module.get<MediaService>(MediaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCoverPresignedUrl', () => {
    it('should call service generateCoverPresignedUrl', async () => {
      const dto: any = {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      };
      const expectedResponse = {
        uploadUrl: 'https://upload.url',
        mediaUrl: 'https://media.url',
        objectKey: 'covers/user-1/test.jpg',
      };

      (mediaService.generateCoverPresignedUrl as jest.Mock).mockResolvedValue(
        expectedResponse,
      );

      const result = await controller.getCoverPresignedUrl(
        { user: { id: 'user-1' } },
        dto,
      );

      expect(mediaService.generateCoverPresignedUrl).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('confirmCoverUpload', () => {
    it('should call service confirmCoverUpload', async () => {
      const expectedResponse = {
        coverUrl: 'https://media.url/covers/user-1/test.jpg',
      };

      (mediaService.confirmCoverUpload as jest.Mock).mockResolvedValue(
        expectedResponse,
      );

      const result = await controller.confirmCoverUpload(
        { user: { id: 'user-1' } },
        'covers/user-1/test.jpg',
      );

      expect(mediaService.confirmCoverUpload).toHaveBeenCalledWith(
        'user-1',
        'covers/user-1/test.jpg',
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('uploadVoiceNote', () => {
    it('should throw BadRequestException when no file is uploaded', async () => {
      await expect(
        controller.uploadVoiceNote(
          { user: { id: 'user-1' } },
          undefined as unknown as Express.Multer.File,
          {},
        ),
      ).rejects.toThrow('No audio file uploaded');
    });

    it('should compress to OGG by default when no format is specified', async () => {
      const file = {
        originalname: 'recording.webm',
        buffer: Buffer.from('fake-audio'),
        mimetype: 'audio/webm',
        size: 1024,
      } as Express.Multer.File;

      const expectedResponse = { url: 'https://media.test/voice-notes/user-1/test.ogg' };
      (mediaService.uploadAndCompressVoiceNote as jest.Mock).mockResolvedValue(
        expectedResponse,
      );

      const result = await controller.uploadVoiceNote(
        { user: { id: 'user-1' } },
        file,
        {},
      );

      expect(mediaService.uploadAndCompressVoiceNote).toHaveBeenCalledWith(
        'user-1',
        file,
        'ogg',
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should compress to M4A when format is specified', async () => {
      const file = {
        originalname: 'recording.webm',
        buffer: Buffer.from('fake-audio'),
        mimetype: 'audio/webm',
        size: 1024,
      } as Express.Multer.File;

      const expectedResponse = { url: 'https://media.test/voice-notes/user-1/test.m4a' };
      (mediaService.uploadAndCompressVoiceNote as jest.Mock).mockResolvedValue(
        expectedResponse,
      );

      const result = await controller.uploadVoiceNote(
        { user: { id: 'user-1' } },
        file,
        { format: 'm4a' },
      );

      expect(mediaService.uploadAndCompressVoiceNote).toHaveBeenCalledWith(
        'user-1',
        file,
        'm4a',
      );
      expect(result).toEqual(expectedResponse);
    });
  });
});

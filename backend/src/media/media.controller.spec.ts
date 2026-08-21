import type { Mock } from 'vitest';
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
            generateCoverPresignedUrl: vi.fn(),
            generateVoiceNotePresignedUrl: vi.fn(),
            confirmCoverUpload: vi.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<MediaController>(MediaController);
    mediaService = module.get<MediaService>(MediaService);
  });

  afterEach(() => {
    vi.clearAllMocks();
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

      (mediaService.generateCoverPresignedUrl as Mock).mockResolvedValue(
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

  describe('getVoiceNotePresignedUrl', () => {
    it('uses the authenticated user identity and dedicated service method', async () => {
      const dto = {
        filename: 'voice.webm',
        contentType: 'audio/webm;codecs=opus',
      };
      const expectedResponse = {
        uploadUrl: 'https://upload.url/voice',
        mediaUrl: 'https://media.url/voice.webm',
        objectKey: 'voice-notes/user-1/voice.webm',
      };

      (mediaService.generateVoiceNotePresignedUrl as Mock).mockResolvedValue(
        expectedResponse,
      );

      const result = await controller.getVoiceNotePresignedUrl(
        { user: { id: 'user-1' } },
        dto,
      );

      expect(mediaService.generateVoiceNotePresignedUrl).toHaveBeenCalledWith(
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

      (mediaService.confirmCoverUpload as Mock).mockResolvedValue(
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
});

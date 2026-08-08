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
            generateAvatarPresignedUrl: jest.fn(),
            confirmAvatarUpload: jest.fn(),
            generateAudioIntroPresignedUrl: jest.fn(),
            confirmAudioIntroUpload: jest.fn(),
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

  describe('getAvatarPresignedUrl', () => {
    it('should call service generateAvatarPresignedUrl', async () => {
      const dto: any = {
        filename: 'avatar.jpg',
        contentType: 'image/jpeg',
      };
      const expectedResponse = {
        uploadUrl: 'https://upload.url',
        mediaUrl: 'https://media.url',
        objectKey: 'avatars/user-1/avatar.jpg',
      };

      (mediaService.generateAvatarPresignedUrl as jest.Mock).mockResolvedValue(
        expectedResponse,
      );

      const result = await controller.getAvatarPresignedUrl(
        { user: { id: 'user-1' } },
        dto,
      );

      expect(mediaService.generateAvatarPresignedUrl).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('confirmAvatarUpload', () => {
    it('should call service confirmAvatarUpload', async () => {
      const expectedResponse = {
        avatarUrl: 'https://media.url/avatars/user-1/avatar.jpg',
      };

      (mediaService.confirmAvatarUpload as jest.Mock).mockResolvedValue(
        expectedResponse,
      );

      const result = await controller.confirmAvatarUpload(
        { user: { id: 'user-1' } },
        'avatars/user-1/avatar.jpg',
      );

      expect(mediaService.confirmAvatarUpload).toHaveBeenCalledWith(
        'user-1',
        'avatars/user-1/avatar.jpg',
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('getAudioIntroPresignedUrl', () => {
    it('should call service generateAudioIntroPresignedUrl', async () => {
      const dto: any = {
        filename: 'intro.ogg',
        contentType: 'audio/ogg',
      };
      const expectedResponse = {
        uploadUrl: 'https://upload.url',
        mediaUrl: 'https://media.url',
        objectKey: 'audio-intros/user-1/intro.ogg',
      };

      (mediaService.generateAudioIntroPresignedUrl as jest.Mock).mockResolvedValue(
        expectedResponse,
      );

      const result = await controller.getAudioIntroPresignedUrl(
        { user: { id: 'user-1' } },
        dto,
      );

      expect(mediaService.generateAudioIntroPresignedUrl).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('confirmAudioIntroUpload', () => {
    it('should call service confirmAudioIntroUpload', async () => {
      const expectedResponse = {
        audioIntroUrl: 'https://media.url/audio-intros/user-1/intro.ogg',
      };

      (mediaService.confirmAudioIntroUpload as jest.Mock).mockResolvedValue(
        expectedResponse,
      );

      const result = await controller.confirmAudioIntroUpload(
        { user: { id: 'user-1' } },
        'audio-intros/user-1/intro.ogg',
      );

      expect(mediaService.confirmAudioIntroUpload).toHaveBeenCalledWith(
        'user-1',
        'audio-intros/user-1/intro.ogg',
      );
      expect(result).toEqual(expectedResponse);
    });
  });
});

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
            generatePresignedUrl: jest.fn(),
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

  describe('getPresignedUrl', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.getPresignedUrl(null, {} as any);
      expect(result).toBeNull();
      expect(mediaService.generatePresignedUrl).not.toHaveBeenCalled();
    });

    it('should call service generatePresignedUrl when user is provided', async () => {
      const dto: any = {
        filename: 'test.jpg',
        folder: 'posts',
        contentType: 'image/jpeg',
      };
      const expectedResponse = {
        uploadUrl: 'https://upload.url',
        mediaUrl: 'https://media.url',
        objectKey: 'posts/user-1/test.jpg',
      };

      (mediaService.generatePresignedUrl as jest.Mock).mockResolvedValue(
        expectedResponse,
      );

      const result = await controller.getPresignedUrl(
        { id: 'user-1' } as any,
        dto,
      );

      expect(mediaService.generatePresignedUrl).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(expectedResponse);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AudioIntroController } from './audio-intro.controller';
import { AudioIntroService } from './audio-intro.service';
import { UpdateAudioIntroDto } from './dto/update-audio-intro.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('AudioIntroController', () => {
  let controller: AudioIntroController;

  const mockService = {
    getAudioIntro: vi.fn(),
    updateAudioIntro: vi.fn(),
    getPresignedUploadUrl: vi.fn(),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AudioIntroController],
      providers: [
        {
          provide: AudioIntroService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = moduleRef.get<AudioIntroController>(AudioIntroController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAudioIntro', () => {
    it('should call the service with the given user id and return the result', async () => {
      const expected = { audio_url: 'https://example.com/audio.mp3' };
      mockService.getAudioIntro.mockResolvedValue(expected);

      const result = await controller.getAudioIntro('user-1');

      expect(mockService.getAudioIntro).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(expected);
    });
  });

  describe('updateAudioIntro', () => {
    it('should call the service with the given user id and audio url', async () => {
      const dto: UpdateAudioIntroDto = {
        audio_url: 'https://example.com/audio.mp3',
      };
      mockService.updateAudioIntro.mockResolvedValue(undefined);

      const req = { user: { id: 'user-1' } };
      const result = await controller.updateAudioIntro(req, 'user-1', dto);

      expect(mockService.updateAudioIntro).toHaveBeenCalledWith(
        'user-1',
        dto.audio_url,
      );
      expect(result).toBeUndefined();
    });

    it('should throw ForbiddenException if user id does not match param id', async () => {
      const dto: UpdateAudioIntroDto = {
        audio_url: 'https://example.com/audio.mp3',
      };
      const req = { user: { id: 'user-2' } };

      await expect(
        controller.updateAudioIntro(req, 'user-1', dto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getUploadUrl', () => {
    it('should call the service with the filename and content type', async () => {
      const body = { filename: 'intro.mp3', contentType: 'audio/mpeg' };
      const expected = {
        uploadUrl: 'https://upload.url',
        mediaUrl: 'https://media.url',
      };
      mockService.getPresignedUploadUrl.mockResolvedValue(expected);

      const result = await controller.getUploadUrl(body);

      expect(mockService.getPresignedUploadUrl).toHaveBeenCalledWith(
        body.filename,
        body.contentType,
      );
      expect(result).toEqual(expected);
    });
  });
});

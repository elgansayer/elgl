import { Test, TestingModule } from '@nestjs/testing';
import { UserInterestsController } from './user-interests.controller';
import { UserInterestsService } from './user-interests.service';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { UpdateInterestsDto } from './dto/update-interests.dto';
import { UnauthorizedException } from '@nestjs/common';

describe('UserInterestsController', () => {
  let controller: UserInterestsController;
  let service: UserInterestsService;

  beforeEach(async () => {
    const mockService = {
      getUserInterests: vi.fn(),
      updateUserInterests: vi.fn(),
      getVocabularyForInterests: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserInterestsController],
      providers: [
        {
          provide: UserInterestsService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserInterestsController>(UserInterestsController);
    service = module.get<UserInterestsService>(UserInterestsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserInterests', () => {
    it('should return tags', async () => {
      const mockTags = ['music', 'reading'];
      vi.mocked(service.getUserInterests).mockResolvedValue(mockTags);
      const user = { id: 'user-1' } as any;
      const result = await controller.getUserInterests(user);
      expect(result).toEqual({ tags: mockTags });
      expect(service.getUserInterests).toHaveBeenCalledWith('user-1');
    });

    it('should throw if no user', async () => {
      await expect(controller.getUserInterests(null)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('updateUserInterests', () => {
    it('should update tags and return success', async () => {
      const dto: UpdateInterestsDto = { tags: ['sports'] };
      vi.mocked(service.updateUserInterests).mockResolvedValue();
      const user = { id: 'user-1' } as any;
      const result = await controller.updateUserInterests(user, dto);
      expect(result).toEqual({ success: true });
      expect(service.updateUserInterests).toHaveBeenCalledWith('user-1', [
        'sports',
      ]);
    });

    it('should throw if no user', async () => {
      const dto: UpdateInterestsDto = { tags: ['sports'] };
      await expect(controller.updateUserInterests(null, dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getVocabulary', () => {
    it('should return vocabulary entries for user tags', async () => {
      const mockTags = ['music'];
      const mockEntries = [
        {
          interestTag: 'music',
          vocabWord: 'guitar',
          translation: 'guitare',
          srsLevel: 0,
        },
      ];
      vi.mocked(service.getUserInterests).mockResolvedValue(mockTags);
      vi.mocked(service.getVocabularyForInterests).mockResolvedValue(
        mockEntries,
      );
      const user = { id: 'user-1' } as any;
      const result = await controller.getVocabulary(user, 'fr');
      expect(result).toEqual({ entries: mockEntries });
      expect(service.getVocabularyForInterests).toHaveBeenCalledWith(
        mockTags,
        'fr',
      );
    });

    it('should return empty entries if user has no tags', async () => {
      vi.mocked(service.getUserInterests).mockResolvedValue([]);
      const user = { id: 'user-1' } as any;
      const result = await controller.getVocabulary(user, 'fr');
      expect(result).toEqual({ entries: [] });
      expect(service.getVocabularyForInterests).not.toHaveBeenCalled();
    });

    it('should throw if no user', async () => {
      await expect(controller.getVocabulary(null, 'fr')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});

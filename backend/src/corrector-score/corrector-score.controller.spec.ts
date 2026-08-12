import { Test, TestingModule } from '@nestjs/testing';
import { CanActivate } from '@nestjs/common';
import { CorrectorScoreController } from './corrector-score.controller';
import { CorrectorScoreService } from './corrector-score.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('CorrectorScoreController', () => {
  let controller: CorrectorScoreController;

  const mockSubmitRating = vi.fn();
  const mockGetCorrectorScore = vi.fn();

  const mockAuthGuard: CanActivate = {
    canActivate: vi.fn(() => true),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [CorrectorScoreController],
      providers: [
        {
          provide: CorrectorScoreService,
          useValue: {
            submitRating: mockSubmitRating,
            getCorrectorScore: mockGetCorrectorScore,
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = moduleRef.get<CorrectorScoreController>(
      CorrectorScoreController,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('rateUser', () => {
    const mockUser = { id: 'rater-1' };
    const dto = { rated_user_id: 'rated-1', score: 5 };

    it('should submit a rating successfully', async () => {
      mockSubmitRating.mockResolvedValue(undefined);

      const result = await controller.rateUser(mockUser, dto);

      expect(result).toEqual({ message: 'Rating submitted' });
      expect(mockSubmitRating).toHaveBeenCalledWith('rater-1', 'rated-1', 5);
    });

    it('should throw UnauthorizedException when no user provided', async () => {
      await expect(
        controller.rateUser(null as unknown as any, dto),
      ).rejects.toThrow();
    });

    it('should throw UnauthorizedException when rating self', async () => {
      const selfDto = { rated_user_id: 'rater-1', score: 5 };
      await expect(controller.rateUser(mockUser, selfDto)).rejects.toThrow(
        'Cannot rate yourself',
      );
    });
  });

  describe('getScore', () => {
    it('should return the corrector score for a user', async () => {
      const scoreResult = { averageScore: 4.5, totalRatings: 10 };
      mockGetCorrectorScore.mockResolvedValue(scoreResult);

      const result = await controller.getScore('user-abc');

      expect(result).toEqual(scoreResult);
      expect(mockGetCorrectorScore).toHaveBeenCalledWith('user-abc');
    });

    it('should return null averageScore for unrated user', async () => {
      mockGetCorrectorScore.mockResolvedValue({
        averageScore: null,
        totalRatings: 0,
      });

      const result = await controller.getScore('new-user');

      expect(result.averageScore).toBeNull();
      expect(result.totalRatings).toBe(0);
    });
  });
});

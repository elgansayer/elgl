import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationsController } from './recommendations.controller';
import {
  RecommendationsService,
  RecommendedUserDto,
} from './recommendations.service';
import { MatchmakingCrashReportService } from './matchmaking-crash-report.service';
import { MatchmakingExceptionFilter } from './matchmaking-exception.filter';
import { CircuitBreakerService } from '../escrow/circuit-breaker.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RecommendationsRateLimiterGuard } from './recommendations-rate-limiter.guard';

// Mock the sanitise helper to avoid ESM import issues with jsdom/dompurify
vi.mock('./sanitise-recommendations.helper', () => ({
  sanitiseRecommendationsData: <T>(value: T): T => value,
}));

describe('RecommendationsController', () => {
  let controller: RecommendationsController;
  let mockService: {
    getRecommendations: Mock;
    getDailyRecommendations: Mock;
  };

  beforeEach(async () => {
    mockService = {
      getRecommendations: vi.fn(),
      getDailyRecommendations: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecommendationsController],
      providers: [
        {
          provide: RecommendationsService,
          useValue: mockService,
        },
        {
          provide: MatchmakingCrashReportService,
          useValue: {
            reportCrash: vi.fn().mockResolvedValue({}),
          },
        },
        {
          provide: CircuitBreakerService,
          useValue: {
            isAvailable: vi.fn().mockReturnValue(true),
          },
        },
        MatchmakingExceptionFilter,
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .overrideGuard(RecommendationsRateLimiterGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<RecommendationsController>(
      RecommendationsController,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /recommendations/for-you', () => {
    it('should return interest-based recommendations', async () => {
      const dtos: RecommendedUserDto[] = [
        {
          id: 'u-1',
          displayName: 'User 1',
          avatarUrl: null,
          nativeLanguage: 'es',
          targetLanguages: ['en'],
          sharedInterests: 3,
          isSeriousLearner: true,
          studyStreakDays: 15,
          correctionRatio: 0.9,
        },
      ];
      mockService.getRecommendations.mockResolvedValue(dtos);

      const req = { user: { id: 'user-123' } };
      const result = await controller.getForYou(req);
      expect(result).toEqual(dtos);
      expect(mockService.getRecommendations).toHaveBeenCalledWith('user-123');
    });
  });

  describe('GET /recommendations/daily', () => {
    it('should return cached daily language partner recommendations', async () => {
      const dtos: RecommendedUserDto[] = [
        {
          id: 'p-1',
          displayName: 'Partner 1',
          avatarUrl: 'http://img/1.png',
          nativeLanguage: 'es',
          targetLanguages: ['en'],
          sharedInterests: 0,
          isSeriousLearner: true,
          studyStreakDays: 30,
          correctionRatio: 0.95,
        },
      ];
      mockService.getDailyRecommendations.mockResolvedValue(dtos);

      const req = { user: { id: 'user-123' } };
      const result = await controller.getDaily(req);
      expect(result).toEqual(dtos);
      expect(mockService.getDailyRecommendations).toHaveBeenCalledWith(
        'user-123',
      );
    });

    it('should return empty array when no daily data cached', async () => {
      mockService.getDailyRecommendations.mockResolvedValue([]);

      const req = { user: { id: 'user-123' } };
      const result = await controller.getDaily(req);
      expect(result).toEqual([]);
    });
  });
});

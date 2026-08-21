import { Test, TestingModule } from '@nestjs/testing';
import { UserStatisticsController } from './user-statistics.controller';
import { UserStatisticsService } from './user-statistics.service';
import { UserStatisticsQueryDto } from './dto/user-statistics-query.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('UserStatisticsController', () => {
  let controller: UserStatisticsController;

  const mockStats = {
    studyStreakDays: 3,
    correctionRatio: 0.8,
    coinsBalance: 100,
    isVip: false,
    accountCreatedAt: '2024-01-01T00:00:00.000Z',
    totalMoments: 10,
    totalComments: 5,
    totalLikesReceived: 12,
    totalProfileVisits: 8,
  };

  const mockService = {
    getUserStatistics: vi.fn(),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UserStatisticsController],
      providers: [
        {
          provide: UserStatisticsService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = moduleRef.get<UserStatisticsController>(
      UserStatisticsController,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserStatistics', () => {
    const userId = 'user-123';
    const query: UserStatisticsQueryDto = {
      fromDate: '2024-01-01',
      toDate: '2024-12-31',
    };

    it('should call the service with the given user id and query', async () => {
      mockService.getUserStatistics.mockResolvedValue(mockStats);

      await controller.getStatistics(userId, query);

      expect(mockService.getUserStatistics).toHaveBeenCalledWith(userId, query);
    });

    it('should return the statistics provided by the service', async () => {
      mockService.getUserStatistics.mockResolvedValue(mockStats);

      const result = await controller.getStatistics(userId, query);

      expect(result).toEqual(mockStats);
    });

    it('should pass an undefined query when no query is supplied', async () => {
      mockService.getUserStatistics.mockResolvedValue(mockStats);

      await controller.getStatistics(userId);

      expect(mockService.getUserStatistics).toHaveBeenCalledWith(
        userId,
        undefined,
      );
    });
  });
});

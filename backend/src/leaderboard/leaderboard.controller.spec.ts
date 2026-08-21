import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService, Corrector } from './leaderboard.service';

describe('LeaderboardController', () => {
  let controller: LeaderboardController;
  const mockGetTopCorrectors = vi.fn();

  const mockCorrectors: Corrector[] = [
    {
      id: 'user-1',
      display_name: 'Alice',
      avatar_url: 'https://example.com/alice.png',
      correction_ratio: 0.95,
      study_streak_days: 120,
      is_serious_learner: true,
    },
    {
      id: 'user-2',
      display_name: 'Bob',
      avatar_url: null,
      correction_ratio: 0.88,
      study_streak_days: 30,
      is_serious_learner: true,
    },
    {
      id: 'user-3',
      display_name: 'Charlie',
      avatar_url: 'https://example.com/charlie.png',
      correction_ratio: 0.45,
      study_streak_days: 3,
      is_serious_learner: false,
    },
  ];

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [LeaderboardController],
      providers: [
        {
          provide: LeaderboardService,
          useValue: {
            getTopCorrectors: mockGetTopCorrectors,
          },
        },
      ],
    }).compile();

    controller = moduleRef.get<LeaderboardController>(LeaderboardController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getTopCorrectors', () => {
    it('should return top correctors with default limit', async () => {
      mockGetTopCorrectors.mockResolvedValue(mockCorrectors);

      const result = await controller.getTopCorrectors();

      expect(result).toEqual(mockCorrectors);
      expect(mockGetTopCorrectors).toHaveBeenCalledWith(20);
    });

    it('should pass custom limit from query string', async () => {
      mockGetTopCorrectors.mockResolvedValue(mockCorrectors.slice(0, 2));

      await controller.getTopCorrectors('5');

      expect(mockGetTopCorrectors).toHaveBeenCalledWith(5);
    });

    it('should handle empty results', async () => {
      mockGetTopCorrectors.mockResolvedValue([]);

      const result = await controller.getTopCorrectors();

      expect(result).toEqual([]);
      expect(mockGetTopCorrectors).toHaveBeenCalledWith(20);
    });
  });
});

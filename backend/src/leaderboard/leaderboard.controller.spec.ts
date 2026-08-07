import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService, Corrector } from './leaderboard.service';

describe('LeaderboardController', () => {
  let controller: LeaderboardController;
  let leaderboardService: LeaderboardService;

  const mockCorrectors: Corrector[] = [
    {
      id: 'user-1',
      display_name: 'Alice',
      avatar_url: 'https://example.com/alice.jpg',
      correction_ratio: 0.95,
      study_streak_days: 30,
      is_serious_learner: true,
    },
    {
      id: 'user-2',
      display_name: 'Bob',
      avatar_url: null,
      correction_ratio: 0.88,
      study_streak_days: 5,
      is_serious_learner: false,
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeaderboardController],
      providers: [
        {
          provide: LeaderboardService,
          useValue: {
            getTopCorrectors: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<LeaderboardController>(LeaderboardController);
    leaderboardService = module.get<LeaderboardService>(LeaderboardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getTopCorrectors', () => {
    it('returns top correctors with default limit of 20', async () => {
      jest
        .spyOn(leaderboardService, 'getTopCorrectors')
        .mockResolvedValue(mockCorrectors);

      const result = await controller.getTopCorrectors();

      expect(leaderboardService.getTopCorrectors).toHaveBeenCalledWith(20);
      expect(result).toEqual(mockCorrectors);
    });

    it('parses the limit query parameter as an integer', async () => {
      jest
        .spyOn(leaderboardService, 'getTopCorrectors')
        .mockResolvedValue(mockCorrectors.slice(0, 1));

      const result = await controller.getTopCorrectors('10');

      expect(leaderboardService.getTopCorrectors).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(1);
    });

    it('uses default limit when limit query is not provided', async () => {
      jest
        .spyOn(leaderboardService, 'getTopCorrectors')
        .mockResolvedValue(mockCorrectors);

      const result = await controller.getTopCorrectors(undefined);

      expect(leaderboardService.getTopCorrectors).toHaveBeenCalledWith(20);
      expect(result).toHaveLength(2);
    });

    it('returns empty array when service returns empty', async () => {
      jest
        .spyOn(leaderboardService, 'getTopCorrectors')
        .mockResolvedValue([]);

      const result = await controller.getTopCorrectors();

      expect(result).toEqual([]);
    });
  });
});
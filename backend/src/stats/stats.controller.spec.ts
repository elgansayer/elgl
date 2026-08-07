import { Test, TestingModule } from '@nestjs/testing';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
<<<<<<< HEAD

describe('StatsController', () => {
  let controller: StatsController;
  let statsService: { getStats: jest.Mock };

  beforeEach(async () => {
    statsService = { getStats: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatsController],
      providers: [{ provide: StatsService, useValue: statsService }],
    })
      .overrideGuard(require('../auth/supabase-auth.guard').SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(StatsController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should call statsService.getStats with the authenticated user id', async () => {
    const mockStats = {
      study_hours: 10,
      messages_sent: 200,
      corrections_made: 30,
      weekly_study_hours: [{ day: 'Mon', hours: 2 }],
      activity_breakdown: [
        { label: 'Messages Sent', count: 200 },
        { label: 'Corrections Made', count: 30 },
      ],
    };
    statsService.getStats.mockResolvedValue(mockStats);

    const req = { user: { sub: 'user-456' } };
    const result = await controller.getMyStats(req);

    expect(statsService.getStats).toHaveBeenCalledWith('user-456');
    expect(result).toEqual(mockStats);
=======
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CanActivate } from '@nestjs/common';

describe('StatsController', () => {
  let controller: StatsController;
  let statsService: StatsService;

  const mockAuthGuard: CanActivate = {
    canActivate: jest.fn(() => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatsController],
      providers: [
        {
          provide: StatsService,
          useValue: {
            getStats: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<StatsController>(StatsController);
    statsService = module.get<StatsService>(StatsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMyStats', () => {
    it('should call statsService.getStats with the authenticated user id', async () => {
      const mockStats = {
        study_hours: [
          { day: 'Sun', hours: 0 },
          { day: 'Mon', hours: 1.5 },
          { day: 'Tue', hours: 2.0 },
          { day: 'Wed', hours: 1.0 },
          { day: 'Thu', hours: 3.5 },
          { day: 'Fri', hours: 2.5 },
          { day: 'Sat', hours: 4.0 },
        ],
        messages_sent: 340,
        corrections_count: 45,
        moments_count: 12,
      };

      jest.spyOn(statsService, 'getStats').mockResolvedValue(mockStats);

      const req = { user: { sub: 'user-1' } };
      const result = await controller.getMyStats(req);

      expect(statsService.getStats).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockStats);
    });
>>>>>>> origin/main
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

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
  });
});
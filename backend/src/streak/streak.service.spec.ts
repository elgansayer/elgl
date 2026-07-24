import { Test, TestingModule } from '@nestjs/testing';
import { StreakService } from './streak.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('StreakService', () => {
  let service: StreakService;
  let supabaseMock: any;

  beforeEach(async () => {
    // Create a mock query builder chain
    const createQueryChain = () => {
      const chain: any = {};
      chain.select = jest.fn().mockReturnValue(chain);
      chain.gt = jest.fn().mockReturnValue(chain);
      chain.lt = jest.fn().mockReturnValue(chain);
      chain.in = jest.fn().mockReturnValue(chain);
      chain.update = jest.fn().mockReturnValue(chain);
      return chain;
    };

    supabaseMock = {
      from: jest.fn().mockReturnValue(createQueryChain()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreakService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(supabaseMock),
          },
        },
      ],
    }).compile();

    service = module.get<StreakService>(StreakService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resetStreaksForTesting', () => {
    it('should reset streaks for users inactive for more than 24 hours', async () => {
      const mockInactiveUsers = [
        {
          id: 'user-1',
          study_streak_days: 5,
          last_active_at: new Date(
            Date.now() - 48 * 60 * 60 * 1000,
          ).toISOString(),
        },
        {
          id: 'user-2',
          study_streak_days: 3,
          last_active_at: new Date(
            Date.now() - 36 * 60 * 60 * 1000,
          ).toISOString(),
        },
      ];

      const chain = supabaseMock.from();
      chain.select.mockReturnValue(chain);
      chain.gt.mockReturnValue(chain);
      chain.lt.mockResolvedValue({ data: mockInactiveUsers, error: null });
      chain.update.mockReturnValue(chain);
      chain.in.mockResolvedValue({ error: null });

      const result = await service.resetStreaksForTesting();
      expect(result).toBe(2);
      expect(chain.update).toHaveBeenCalledWith({ study_streak_days: 0 });
      expect(chain.in).toHaveBeenCalledWith('id', ['user-1', 'user-2']);
    });

    it('should return 0 when no inactive users found', async () => {
      const chain = supabaseMock.from();
      chain.select.mockReturnValue(chain);
      chain.gt.mockReturnValue(chain);
      chain.lt.mockResolvedValue({ data: [], error: null });

      const result = await service.resetStreaksForTesting();
      expect(result).toBe(0);
    });

    it('should return 0 on query error', async () => {
      const chain = supabaseMock.from();
      chain.select.mockReturnValue(chain);
      chain.gt.mockReturnValue(chain);
      chain.lt.mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      });

      const result = await service.resetStreaksForTesting();
      expect(result).toBe(0);
    });

    it('should return 0 on update error', async () => {
      const mockInactiveUsers = [
        {
          id: 'user-1',
          study_streak_days: 5,
          last_active_at: new Date(
            Date.now() - 48 * 60 * 60 * 1000,
          ).toISOString(),
        },
      ];

      const chain = supabaseMock.from();
      chain.select.mockReturnValue(chain);
      chain.gt.mockReturnValue(chain);
      chain.lt.mockResolvedValue({ data: mockInactiveUsers, error: null });
      chain.update.mockReturnValue(chain);
      chain.in.mockResolvedValue({ error: { message: 'Update failed' } });

      const result = await service.resetStreaksForTesting();
      expect(result).toBe(0);
    });
  });

  describe('handleStreakResetCron', () => {
    it('should call resetStreaksForTesting and log result', async () => {
      const resetSpy = jest
        .spyOn(service, 'resetStreaksForTesting')
        .mockResolvedValue(3);
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.handleStreakResetCron();

      expect(resetSpy).toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(
        'Running scheduled streak reset job',
      );
    });

    it('should handle zero resets gracefully', async () => {
      jest.spyOn(service, 'resetStreaksForTesting').mockResolvedValue(0);
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.handleStreakResetCron();

      expect(loggerSpy).toHaveBeenCalledWith(
        'Running scheduled streak reset job',
      );
    });
  });
});

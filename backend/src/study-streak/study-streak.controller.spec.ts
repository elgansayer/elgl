import { Test, TestingModule } from '@nestjs/testing';
import { StudyStreakController } from './study-streak.controller';
import { StudyStreakService } from './study-streak.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('StudyStreakController', () => {
  let controller: StudyStreakController;
  let service: StudyStreakService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudyStreakController],
      providers: [
        {
          provide: StudyStreakService,
          useValue: {
            getStreak: vi.fn().mockResolvedValue(5),
            updateStreak: vi.fn().mockResolvedValue(6),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<StudyStreakController>(StudyStreakController);
    service = module.get<StudyStreakService>(StudyStreakService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMyStreak', () => {
    it('returns the streak for the authenticated user', async () => {
      const result = await controller.getMyStreak({ user: { sub: 'user-1' } });
      expect(service.getStreak).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ streak: 5 });
    });

    it('falls back to user.id when sub is absent', async () => {
      await controller.getMyStreak({ user: { id: 'user-2' } });
      expect(service.getStreak).toHaveBeenCalledWith('user-2');
    });

    it('falls back to an empty string when no user is present', async () => {
      await controller.getMyStreak({});
      expect(service.getStreak).toHaveBeenCalledWith('');
    });
  });

  describe('checkin', () => {
    it('updates and returns the streak for the authenticated user', async () => {
      const result = await controller.checkin({ user: { sub: 'user-1' } });
      expect(service.updateStreak).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ streak: 6 });
    });
  });

  describe('health', () => {
    it('returns ok true', () => {
      const result = controller.health();
      expect(result).toEqual({ ok: true });
    });
  });
});

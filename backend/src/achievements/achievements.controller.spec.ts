import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AchievementsController } from './achievements.controller';
import { AchievementsService } from './achievements.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('AchievementsController', () => {
  let controller: AchievementsController;
  let service: {
    listAchievements: Mock;
    getUserAchievements: Mock;
    getFullAchievements: Mock;
    evaluateAchievements: Mock;
  };

  beforeEach(async () => {
    service = {
      listAchievements: vi.fn().mockResolvedValue([]),
      getUserAchievements: vi.fn().mockResolvedValue([]),
      getFullAchievements: vi.fn().mockResolvedValue([]),
      evaluateAchievements: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AchievementsController],
      providers: [
        {
          provide: AchievementsService,
          useValue: service,
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AchievementsController>(AchievementsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listAchievements', () => {
    it('returns the full list of achievement definitions', async () => {
      const rows = [
        { id: 'a1', code: 'first', name: 'First', description: 'desc' },
      ];
      service.listAchievements.mockResolvedValue(rows);

      await expect(controller.listAchievements()).resolves.toEqual(rows);
    });
  });

  describe('getUserAchievements', () => {
    it('delegates to the service with the requested user id', async () => {
      await controller.getUserAchievements('user-1');
      expect(service.getUserAchievements).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getFullAchievements', () => {
    it('delegates to the service with the requested user id', async () => {
      await controller.getFullAchievements('user-1');
      expect(service.getFullAchievements).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getMyAchievements', () => {
    it('returns full achievements for the authenticated user', async () => {
      const req = { user: { id: 'user-1' } };
      await controller.getMyAchievements(req as any);
      expect(service.getFullAchievements).toHaveBeenCalledWith('user-1');
    });

    it('throws UnauthorizedException when req.user is missing', async () => {
      const req = {};
      await expect(controller.getMyAchievements(req as any)).rejects.toThrow();
    });
  });

  describe('evaluateForCurrentUser', () => {
    it('evaluates achievements for the authenticated user', async () => {
      const req = { user: { id: 'user-1' } };
      const result = await controller.evaluateForCurrentUser(req as any);
      expect(service.evaluateAchievements).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ evaluated: true });
    });

    it('throws UnauthorizedException when req.user is missing', async () => {
      const req = {};
      await expect(
        controller.evaluateForCurrentUser(req as any),
      ).rejects.toThrow();
    });
  });

  describe('evaluateForUser', () => {
    it('evaluates achievements for the given user id', async () => {
      const result = await controller.evaluateForUser('user-2');
      expect(service.evaluateAchievements).toHaveBeenCalledWith('user-2');
      expect(result).toEqual({ evaluated: true });
    });
  });
});

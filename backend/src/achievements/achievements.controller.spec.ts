import type { Mock } from 'vitest';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
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
    it('returns earned badge definitions for a requested profile', async () => {
      await controller.getUserAchievements('user-2');
      expect(service.getUserAchievements).toHaveBeenCalledWith('user-2');
    });
  });

  describe('getFullAchievements', () => {
    it('returns progress for the authenticated user', async () => {
      const req = { user: { id: 'user-1' } };

      await controller.getFullAchievements('user-1', req as any);

      expect(service.getFullAchievements).toHaveBeenCalledWith('user-1');
    });

    it('rejects cross-user progress reads', async () => {
      const req = { user: { id: 'user-1' } };

      await expect(
        controller.getFullAchievements('user-2', req as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(service.getFullAchievements).not.toHaveBeenCalled();
    });

    it('rejects requests without an authenticated user', async () => {
      await expect(
        controller.getFullAchievements('user-1', {} as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('getMyAchievements', () => {
    it('returns full achievements for the authenticated user', async () => {
      const req = { user: { id: 'user-1' } };
      await controller.getMyAchievements(req as any);
      expect(service.getFullAchievements).toHaveBeenCalledWith('user-1');
    });

    it('throws UnauthorizedException when req.user is missing', async () => {
      await expect(
        controller.getMyAchievements({} as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
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
      await expect(
        controller.evaluateForCurrentUser({} as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('evaluateForUser', () => {
    it('keeps the compatibility route for self evaluation', async () => {
      const req = { user: { id: 'user-1' } };

      const result = await controller.evaluateForUser('user-1', req as any);

      expect(service.evaluateAchievements).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ evaluated: true });
    });

    it('rejects cross-user evaluation attempts', async () => {
      const req = { user: { id: 'user-1' } };

      await expect(
        controller.evaluateForUser('user-2', req as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(service.evaluateAchievements).not.toHaveBeenCalled();
    });
  });
});

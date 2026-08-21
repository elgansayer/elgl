import { Test } from '@nestjs/testing';
import { XpController } from './xp.controller';
import { XpService } from './xp.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UnauthorizedException } from '@nestjs/common';

type XpHistoryEntry = {
  id: string;
  user_id: string;
  points: number;
  activity: string;
  created_at: string;
};

describe('XpController', () => {
  let controller: XpController;

  const mockXpService = {
    getXpTotal: vi.fn<Promise<number>, [string]>(),
    getLevel: vi.fn<Promise<number>, [string]>(),
    getXpHistory: vi.fn<
      Promise<XpHistoryEntry[]>,
      [string, number?, number?]
    >(),
    getActivityPoints: vi.fn<Record<string, number>, []>(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [XpController],
      providers: [{ provide: XpService, useValue: mockXpService }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = moduleRef.get<XpController>(XpController);
    vi.clearAllMocks();
  });

  const makeReq = (user?: { sub?: string; id?: string }) =>
    ({ user: user ?? {} }) as { user?: { sub?: string; id?: string } };

  describe('getXp', () => {
    it('should return total and level for authenticated user based on sub', async () => {
      const userId = 'sub-user-id';
      mockXpService.getXpTotal.mockResolvedValue(1250);
      mockXpService.getLevel.mockResolvedValue(5);

      const result = await controller.getXp(makeReq({ sub: userId }));

      expect(mockXpService.getXpTotal).toHaveBeenCalledWith(userId);
      expect(mockXpService.getLevel).toHaveBeenCalledWith(userId);
      expect(result).toEqual({ total: 1250, level: 5 });
    });

    it('should use id when sub is not present', async () => {
      const userId = 'id-user-id';
      mockXpService.getXpTotal.mockResolvedValue(0);
      mockXpService.getLevel.mockResolvedValue(1);

      const result = await controller.getXp(makeReq({ id: userId }));

      expect(mockXpService.getXpTotal).toHaveBeenCalledWith(userId);
      expect(mockXpService.getLevel).toHaveBeenCalledWith(userId);
      expect(result).toEqual({ total: 0, level: 1 });
    });

    it('should throw UnauthorizedException when request has no user', async () => {
      await expect(controller.getXp(makeReq())).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when req.user is absent', async () => {
      await expect(controller.getXp({})).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getXpHistory', () => {
    const history: XpHistoryEntry[] = [
      {
        id: 'h1',
        user_id: 'user-1',
        points: 10,
        activity: 'LESSON',
        created_at: '2026-08-01T00:00:00Z',
      },
    ];

    it('should call service with default limit and offset', async () => {
      mockXpService.getXpHistory.mockResolvedValue(history);

      const result = await controller.getXpHistory(makeReq({ sub: 'user-1' }));

      expect(mockXpService.getXpHistory).toHaveBeenCalledWith('user-1', 50, 0);
      expect(result).toEqual(history);
    });

    it('should pass explicit limit and offset query params', async () => {
      mockXpService.getXpHistory.mockResolvedValue([]);

      await controller.getXpHistory(makeReq({ sub: 'user-1' }), 10, 5);

      expect(mockXpService.getXpHistory).toHaveBeenCalledWith('user-1', 10, 5);
    });

    it('should throw UnauthorizedException when missing user', async () => {
      await expect(controller.getXpHistory(makeReq())).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getActivityPoints', () => {
    it('should return the activity points mapping', () => {
      const points = { LESSON: 5, LOGIN: 1 };
      mockXpService.getActivityPoints.mockReturnValue(points);

      const result = controller.getActivityPoints();

      expect(mockXpService.getActivityPoints).toHaveBeenCalledTimes(1);
      expect(result).toEqual(points);
    });
  });
});

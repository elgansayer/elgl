import type { Mock } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@supabase/supabase-js';
import { DailyTipController } from './daily-tip.controller';
import { DailyTipService } from './daily-tip.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('DailyTipController', () => {
  let controller: DailyTipController;
  let service: { getTodayTipForUser: Mock };

  beforeEach(async () => {
    service = {
      getTodayTipForUser: vi
        .fn()
        .mockResolvedValue('Practise a little every day.'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DailyTipController],
      providers: [{ provide: DailyTipService, useValue: service }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<DailyTipController>(DailyTipController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it("returns the authenticated user's tip", async () => {
    const mockUser = { id: 'user-1' } as User;

    const result = await controller.getTodayTip(mockUser);

    expect(service.getTodayTipForUser).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ tip: 'Practise a little every day.' });
  });

  it('throws when there is no authenticated user', async () => {
    await expect(controller.getTodayTip(null)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(service.getTodayTipForUser).not.toHaveBeenCalled();
  });
});

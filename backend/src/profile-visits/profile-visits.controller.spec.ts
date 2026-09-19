import type { Mock } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProfileVisitsController } from './profile-visits.controller';
import { ProfileVisitsService } from './profile-visits.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('ProfileVisitsController', () => {
  let controller: ProfileVisitsController;
  let profileVisitsService: {
    recordVisit: Mock;
    getVisitors: Mock;
  };

  beforeEach(async () => {
    profileVisitsService = {
      recordVisit: vi.fn(),
      getVisitors: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileVisitsController],
      providers: [
        {
          provide: ProfileVisitsService,
          useValue: profileVisitsService,
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<ProfileVisitsController>(ProfileVisitsController);
  });

  afterEach(() => vi.clearAllMocks());

  it('fails closed when the authenticated user is missing', async () => {
    await expect(
      controller.recordVisit(null, 'target-1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.getMyVisitors(null, 20, 0)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(profileVisitsService.recordVisit).not.toHaveBeenCalled();
    expect(profileVisitsService.getVisitors).not.toHaveBeenCalled();
  });

  it('records a visit without trusting client-side or mock VIP state', async () => {
    profileVisitsService.recordVisit.mockResolvedValue({
      recorded: true,
      ignored: false,
      visit_id: 'visit-1',
    });

    const result = await controller.recordVisit(
      { id: 'viewer-1' } as any,
      'target-1',
    );

    expect(profileVisitsService.recordVisit).toHaveBeenCalledWith(
      'viewer-1',
      'target-1',
    );
    expect(result).toEqual({
      recorded: true,
      ignored: false,
      visit_id: 'visit-1',
    });
  });

  it('passes bounded pagination inputs to the canonical visitor service', async () => {
    profileVisitsService.getVisitors.mockResolvedValue({
      items: [],
      identity_visible: false,
      limit: 20,
      offset: 40,
      has_more: false,
      next_offset: null,
    });

    const result = await controller.getMyVisitors(
      { id: 'owner-1' } as any,
      20,
      40,
    );

    expect(profileVisitsService.getVisitors).toHaveBeenCalledWith(
      'owner-1',
      20,
      40,
    );
    expect(result.offset).toBe(40);
  });
});

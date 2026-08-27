import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ProfileVisitsController } from './profile-visits.controller';
import { ProfileVisitsService } from './profile-visits.service';
import { UsersService } from '../users/users.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('ProfileVisitsController', () => {
  let controller: ProfileVisitsController;
  let profileVisitsService: ProfileVisitsService;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileVisitsController],
      providers: [
        {
          provide: ProfileVisitsService,
          useValue: {
            recordVisit: vi.fn(),
            getVisitors: vi.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getProfile: vi.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<ProfileVisitsController>(ProfileVisitsController);
    profileVisitsService =
      module.get<ProfileVisitsService>(ProfileVisitsService);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('recordVisit', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.recordVisit(null, 'target-1');
      expect(result).toBeNull();
      expect(profileVisitsService.recordVisit).not.toHaveBeenCalled();
    });

    it('should fetch user profile and record visit passing is_vip status', async () => {
      const profile: any = { id: 'user-1', is_vip: true };
      const visitResult = { id: 'visit-1' };

      (usersService.getProfile as Mock).mockResolvedValue(profile);
      (profileVisitsService.recordVisit as Mock).mockResolvedValue(visitResult);

      const result = await controller.recordVisit(
        { id: 'user-1' } as any,
        'target-1',
      );

      expect(usersService.getProfile).toHaveBeenCalledWith('user-1');
      expect(profileVisitsService.recordVisit).toHaveBeenCalledWith(
        'user-1',
        'target-1',
        true,
      );
      expect(result).toEqual(visitResult);
    });

    it('should fallback to false for isVip when user profile returns undefined is_vip', async () => {
      (usersService.getProfile as Mock).mockResolvedValue({});
      (profileVisitsService.recordVisit as Mock).mockResolvedValue({
        id: 'visit-2',
      });

      await controller.recordVisit({ id: 'user-1' } as any, 'target-1');

      expect(profileVisitsService.recordVisit).toHaveBeenCalledWith(
        'user-1',
        'target-1',
        false,
      );
    });
  });

  describe('getMyVisitors', () => {
    it('should return empty array if user is not provided', async () => {
      const result = await controller.getMyVisitors(null);
      expect(result).toEqual([]);
      expect(profileVisitsService.getVisitors).not.toHaveBeenCalled();
    });

    it('should fetch user profile and return visitors list with is_vip status', async () => {
      const profile: any = { id: 'user-1', is_vip: false };
      const visitors: any[] = [{ id: 'visit-1', is_blurred: true }];

      (usersService.getProfile as Mock).mockResolvedValue(profile);
      (profileVisitsService.getVisitors as Mock).mockResolvedValue(visitors);

      const result = await controller.getMyVisitors({ id: 'user-1' } as any);

      expect(usersService.getProfile).toHaveBeenCalledWith('user-1');
      expect(profileVisitsService.getVisitors).toHaveBeenCalledWith(
        'user-1',
        false,
      );
      expect(result).toEqual(visitors);
    });
  });
});

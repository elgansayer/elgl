import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SafetyController } from './safety.controller';
import { SafetyService } from './safety.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('SafetyController', () => {
  let controller: SafetyController;
  let safetyService: SafetyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SafetyController],
      providers: [
        {
          provide: SafetyService,
          useValue: {
            getCategories: vi.fn(),
            reportUser: vi.fn(),
            blockUser: vi.fn(),
            unblockUser: vi.fn(),
            getBlockedUserIds: vi.fn(),
            getBlockerUserIds: vi.fn(),
            getBlockedAndBlockerIds: vi.fn(),
            getBlockedUserDetails: vi.fn(),
            isBlocked: vi.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<SafetyController>(SafetyController);
    safetyService = module.get<SafetyService>(SafetyService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getReportCategories', () => {
    it('should return categories from service', () => {
      const categories = [
        { value: 'spam', label: 'Spam', icon: '*', description: '...' },
      ];
      (safetyService.getCategories as Mock).mockReturnValue(categories);

      const result = controller.getReportCategories();
      expect(safetyService.getCategories).toHaveBeenCalled();
      expect(result).toEqual(categories);
    });
  });

  describe('reportUser', () => {
    it('should call service reportUser when user is provided', async () => {
      const dto: any = { reported_id: 'bad-1', reason_category: 'spam' };
      (safetyService.reportUser as Mock).mockResolvedValue(undefined);

      const result = await controller.reportUser(
        { user: { id: 'user-1' } },
        dto,
      );
      expect(safetyService.reportUser).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual({
        success: true,
        message: 'Report submitted successfully',
      });
    });
  });

  describe('blockUser', () => {
    it('should call service blockUser when user is provided', async () => {
      const dto: any = { blocked_id: 'bad-2' };
      const response: any = { success: true, blocked_id: 'bad-2' };
      (safetyService.blockUser as Mock).mockResolvedValue(response);

      const result = await controller.blockUser(
        { user: { id: 'user-1' } },
        dto,
      );
      expect(safetyService.blockUser).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(response);
    });
  });

  describe('unblockUser', () => {
    it('should call service unblockUser', async () => {
      const dto = { blocked_id: 'bad-2' };
      (safetyService.unblockUser as Mock).mockResolvedValue({
        success: true,
      });

      const result = await controller.unblockUser(
        { user: { id: 'user-1' } },
        dto,
      );
      expect(safetyService.unblockUser).toHaveBeenCalledWith('user-1', 'bad-2');
      expect(result).toEqual({ success: true });
    });
  });

  describe('getBlockedIds', () => {
    it('should call service getBlockedUserIds when user is provided', async () => {
      const ids = ['bad-1', 'bad-2'];
      (safetyService.getBlockedUserIds as Mock).mockResolvedValue(ids);

      const result = await controller.getBlockedIds({ user: { id: 'user-1' } });
      expect(safetyService.getBlockedUserIds).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(ids);
    });
  });

  describe('getBlockedUsers', () => {
    it('should call service getBlockedUserIds', async () => {
      const ids = ['bad-1'];
      (safetyService.getBlockedUserIds as Mock).mockResolvedValue(ids);

      const result = await controller.getBlockedUsers({
        user: { id: 'user-1' },
      });
      expect(safetyService.getBlockedUserIds).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(ids);
    });
  });

  describe('getBlockedUserIds', () => {
    it('should call service getBlockedUserIds with param userId', async () => {
      const ids = ['bad-1'];
      (safetyService.getBlockedUserIds as Mock).mockResolvedValue(ids);

      const result = await controller.getBlockedUserIds('user-1');
      expect(safetyService.getBlockedUserIds).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(ids);
    });
  });

  describe('getBlockerUserIds', () => {
    it('should call service getBlockerUserIds with param userId', async () => {
      const ids = ['blocker-1'];
      (safetyService.getBlockerUserIds as Mock).mockResolvedValue(ids);

      const result = await controller.getBlockerUserIds('user-1');
      expect(safetyService.getBlockerUserIds).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(ids);
    });
  });

  describe('isBlocked', () => {
    it('should call service isBlocked and return result', async () => {
      (safetyService.isBlocked as Mock).mockResolvedValue(true);

      const result = await controller.isBlocked(
        { user: { id: 'user-1' } },
        'blocked-id',
      );
      expect(safetyService.isBlocked).toHaveBeenCalledWith(
        'user-1',
        'blocked-id',
      );
      expect(result).toEqual({ blocked: true });
    });

    it('should return false when user is not blocked', async () => {
      (safetyService.isBlocked as Mock).mockResolvedValue(false);

      const result = await controller.isBlocked(
        { user: { id: 'user-1' } },
        'blocked-id',
      );
      expect(result).toEqual({ blocked: false });
    });
  });

  describe('blockUserByParam', () => {
    it('should call service blockUser with param', async () => {
      (safetyService.blockUser as Mock).mockResolvedValue({
        success: true,
        blocked_id: 'blocked-user',
      });

      const result = await controller.blockUserByParam(
        { user: { id: 'user-1' } },
        'blocked-user',
      );
      expect(safetyService.blockUser).toHaveBeenCalledWith('user-1', {
        blocked_id: 'blocked-user',
      });
      expect(result).toEqual({ success: true, blocked_id: 'blocked-user' });
    });
  });

  describe('unblockUserByParam', () => {
    it('should call service unblockUser with param', async () => {
      (safetyService.unblockUser as Mock).mockResolvedValue({
        success: true,
      });

      const result = await controller.unblockUserByParam(
        { user: { id: 'user-1' } },
        'blocked-user',
      );
      expect(safetyService.unblockUser).toHaveBeenCalledWith(
        'user-1',
        'blocked-user',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('getBlockedAndBlockerIds', () => {
    it('should return union of blocked and blocker IDs', async () => {
      const ids = ['blocked-1', 'blocker-1'];
      (safetyService.getBlockedAndBlockerIds as Mock).mockResolvedValue(ids);

      const result = await controller.getBlockedAndBlockerIds('user-1');
      expect(safetyService.getBlockedAndBlockerIds).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual(ids);
    });
  });

  describe('getBlockedUserDetails', () => {
    it('should call service getBlockedUserDetails', async () => {
      const details = [{ id: 'b1', display_name: 'Blocked', avatar_url: null }];
      (safetyService.getBlockedUserDetails as Mock).mockResolvedValue(details);

      const result = await controller.getBlockedUserDetails({
        user: { id: 'user-1' },
      });
      expect(safetyService.getBlockedUserDetails).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual(details);
    });
  });
});

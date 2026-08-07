import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AdminGuard } from './guards/admin.guard';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: {
            listUsers: jest.fn(),
            setVipStatus: jest.fn(),
            getLoginHistory: jest.fn(),
            banUser: jest.fn(),
            warnUser: jest.fn(),
            listBlockedUsers: jest.fn(),
            adminUnblockUser: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<AdminController>(AdminController);
    adminService = module.get<AdminService>(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listUsers', () => {
    it('delegates to AdminService.listUsers with the query params', async () => {
      const response = { users: [], total: 0, page: 1, pageSize: 20 };
      (adminService.listUsers as jest.Mock).mockResolvedValue(response);

      const result = await controller.listUsers({ page: 1, pageSize: 20 });

      expect(adminService.listUsers).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
      });
      expect(result).toEqual(response);
    });
  });

  describe('setVipStatus', () => {
    it('delegates to AdminService.setVipStatus', async () => {
      const response = { id: 'user-1', is_vip: true };
      (adminService.setVipStatus as jest.Mock).mockResolvedValue(response);

      const result = await controller.setVipStatus('user-1', {
        is_vip: true,
      });

      expect(adminService.setVipStatus).toHaveBeenCalledWith('user-1', {
        is_vip: true,
      });
      expect(result).toEqual(response);
    });
  });

  describe('getLoginHistory', () => {
    it('delegates to AdminService.getLoginHistory', async () => {
      const history = [{ id: 'log-1' }];
      (adminService.getLoginHistory as jest.Mock).mockResolvedValue(history);

      const result = await controller.getLoginHistory('user-1');

      expect(adminService.getLoginHistory).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(history);
    });
  });

  describe('listBlockedUsers', () => {
    it('delegates to AdminService.listBlockedUsers', async () => {
      const blocked = [{ id: 'blocked-1', display_name: 'Spammer' }];
      (adminService.listBlockedUsers as jest.Mock).mockResolvedValue(blocked);

      const result = await controller.listBlockedUsers();

      expect(adminService.listBlockedUsers).toHaveBeenCalled();
      expect(result).toEqual(blocked);
    });
  });

  describe('adminUnblockUser', () => {
    it('delegates to AdminService.adminUnblockUser', async () => {
      (adminService.adminUnblockUser as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.adminUnblockUser('user-1');

      expect(adminService.adminUnblockUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ message: 'User unblocked' });
    });
  });

  describe('banUser', () => {
    it('delegates to AdminService.banUser and returns a message', async () => {
      (adminService.banUser as jest.Mock).mockResolvedValue(undefined);

      const mockReq = { user: { sub: 'admin-user' } };
      const result = await controller.banUser('user-99', mockReq as any);

      expect(adminService.banUser).toHaveBeenCalledWith('user-99', 'admin-user');
      expect(result).toEqual({ message: 'User banned' });
    });
  });

  describe('warnUser', () => {
    it('delegates to AdminService.warnUser and returns a message', async () => {
      (adminService.warnUser as jest.Mock).mockResolvedValue(undefined);

      const mockReq = { user: { sub: 'admin-user' } };
      const result = await controller.warnUser('user-99', mockReq as any);

      expect(adminService.warnUser).toHaveBeenCalledWith('user-99', 'admin-user');
      expect(result).toEqual({ message: 'User warned' });
    });
  });
});

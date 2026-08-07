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
            banUser: jest.fn().mockResolvedValue(undefined),
            warnUser: jest.fn().mockResolvedValue(undefined),
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

  describe('banUser', () => {
    it('delegates to AdminService.banUser with user id and admin id', async () => {
      const req = { user: { sub: 'admin-1' } } as unknown as Request & { user: { sub: string } };

      const result = await controller.banUser('user-1', req as any);

      expect(adminService.banUser).toHaveBeenCalledWith('user-1', 'admin-1');
      expect(result).toEqual({ message: 'User banned' });
    });
  });

  describe('warnUser', () => {
    it('delegates to AdminService.warnUser with user id and admin id', async () => {
      const req = { user: { sub: 'admin-1' } } as unknown as Request & { user: { sub: string } };

      const result = await controller.warnUser('user-1', req as any);

      expect(adminService.warnUser).toHaveBeenCalledWith('user-1', 'admin-1');
      expect(result).toEqual({ message: 'User warned' });
    });
  });
});

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
            listAllBlocks: jest.fn(),
            removeBlock: jest.fn(),
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
    it('delegates to AdminService.banUser with the user id and admin id', async () => {
      (adminService.banUser as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.banUser('target-user', {
        user: { sub: 'admin-1' },
      } as any);

      expect(adminService.banUser).toHaveBeenCalledWith(
        'target-user',
        'admin-1',
      );
      expect(result).toEqual({ message: 'User banned' });
    });
  });

  describe('warnUser', () => {
    it('delegates to AdminService.warnUser with the user id and admin id', async () => {
      (adminService.warnUser as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.warnUser('target-user', {
        user: { sub: 'admin-1' },
      } as any);

      expect(adminService.warnUser).toHaveBeenCalledWith(
        'target-user',
        'admin-1',
      );
      expect(result).toEqual({ message: 'User warned' });
    });
  });

  describe('listAllBlocks', () => {
    it('delegates to AdminService.listAllBlocks with default page params', async () => {
      const response = { blocks: [], total: 0, page: 1, pageSize: 20 };
      (adminService.listAllBlocks as jest.Mock).mockResolvedValue(response);

      const result = await controller.listAllBlocks(undefined, undefined);

      expect(adminService.listAllBlocks).toHaveBeenCalledWith(1, 20);
      expect(result).toEqual(response);
    });

    it('parses page and pageSize query params', async () => {
      const response = { blocks: [], total: 0, page: 2, pageSize: 10 };
      (adminService.listAllBlocks as jest.Mock).mockResolvedValue(response);

      const result = await controller.listAllBlocks('2', '10');

      expect(adminService.listAllBlocks).toHaveBeenCalledWith(2, 10);
      expect(result).toEqual(response);
    });
  });

  describe('removeBlock', () => {
    it('delegates to AdminService.removeBlock with the block id', async () => {
      (adminService.removeBlock as jest.Mock).mockResolvedValue({
        success: true,
      });

      const result = await controller.removeBlock('block-42');

      expect(adminService.removeBlock).toHaveBeenCalledWith('block-42');
      expect(result).toEqual({ success: true });
    });
  });
});

import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('BlocksController', () => {
  let controller: BlocksController;
  let blocksService: BlocksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlocksController],
      providers: [
        {
          provide: BlocksService,
          useValue: {
            getBlockedUsers: vi.fn(),
            unblockUser: vi.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<BlocksController>(BlocksController);
    blocksService = module.get<BlocksService>(BlocksService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getBlockedUsers', () => {
    it('should call service getBlockedUsers when user is authenticated', async () => {
      const blockedUsers = [
        { id: 'b1', display_name: 'Blocked', avatar_url: null },
      ];
      (blocksService.getBlockedUsers as Mock).mockResolvedValue(blockedUsers);

      const user = { id: 'user-1' } as any;
      const result = await controller.getBlockedUsers(user);

      expect(blocksService.getBlockedUsers).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(blockedUsers);
    });

    it('should throw UnauthorizedException when user is null', async () => {
      await expect(controller.getBlockedUsers(null)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('unblockUser', () => {
    it('should call service unblockUser when user is authenticated', async () => {
      (blocksService.unblockUser as Mock).mockResolvedValue({
        success: true,
      });

      const user = { id: 'user-1' } as any;
      const result = await controller.unblockUser(user, 'blocked-user');

      expect(blocksService.unblockUser).toHaveBeenCalledWith(
        'user-1',
        'blocked-user',
      );
      expect(result).toEqual({ success: true });
    });

    it('should throw UnauthorizedException when user is null', async () => {
      await expect(
        controller.unblockUser(null, 'blocked-user'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});

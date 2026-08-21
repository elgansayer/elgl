import { Test, TestingModule } from '@nestjs/testing';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('BlocksController', () => {
  let controller: BlocksController;
  let service: BlocksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlocksController],
      providers: [
        {
          provide: BlocksService,
          useValue: {
            getBlockedUsers: vi.fn(),
            blockUser: vi.fn(),
            unblockUser: vi.fn(),
          },
        },
        {
          provide: SupabaseService,
          useValue: { getClient: vi.fn() },
        },
      ],
    }).compile();

    controller = module.get<BlocksController>(BlocksController);
    service = module.get<BlocksService>(BlocksService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should block a user successfully', async () => {
    const mockUser = { id: 'user123' } as any;
    const body = { blocked_id: 'block456' };
    const expectedResult = { success: true };

    vi.mocked(service.blockUser).mockResolvedValue(expectedResult);

    const result = await controller.blockUser(mockUser, body);

    expect(result).toEqual(expectedResult);
    expect(service.blockUser).toHaveBeenCalledWith('user123', 'block456');
  });

  it('should unblock a user successfully', async () => {
    const mockUser = { id: 'user123' } as any;
    const blockedId = 'block456';
    const expectedResult = { success: true };

    vi.mocked(service.unblockUser).mockResolvedValue(expectedResult);

    const result = await controller.unblockUser(mockUser, blockedId);

    expect(result).toEqual(expectedResult);
    expect(service.unblockUser).toHaveBeenCalledWith('user123', 'block456');
  });

  it('should get blocked users successfully', async () => {
    const mockUser = { id: 'user123' } as any;
    const expectedResult = [{ id: 'block456' }] as any;

    vi.mocked(service.getBlockedUsers).mockResolvedValue(expectedResult);

    const result = await controller.getBlockedUsers(mockUser);

    expect(result).toEqual(expectedResult);
    expect(service.getBlockedUsers).toHaveBeenCalledWith('user123');
  });

  it('should throw error when blockUser called with null user', async () => {
    const body = { blocked_id: 'block456' };
    await expect(controller.blockUser(null, body)).rejects.toThrow();
  });

  it('should throw error when unblockUser called with null user', async () => {
    await expect(controller.unblockUser(null, 'block456')).rejects.toThrow();
  });

  it('should throw error when getBlockedUsers called with null user', async () => {
    await expect(controller.getBlockedUsers(null)).rejects.toThrow();
  });
});

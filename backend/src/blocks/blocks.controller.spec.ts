import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';

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
      ],
    }).compile();

    controller = module.get<BlocksController>(BlocksController);
    service = module.get<BlocksService>(BlocksService);
  });

  afterEach(() => vi.clearAllMocks());

  it('uses bounded pagination defaults for blocked users', async () => {
    const expected = [{ id: 'blocked-1' }] as any;
    vi.mocked(service.getBlockedUsers).mockResolvedValue(expected);

    const result = await controller.getBlockedUsers({ id: 'user-1' } as any);

    expect(service.getBlockedUsers).toHaveBeenCalledWith('user-1', 100, 0);
    expect(result).toEqual(expected);
  });

  it('passes validated pagination to the service', async () => {
    vi.mocked(service.getBlockedUsers).mockResolvedValue([]);

    await controller.getBlockedUsers({ id: 'user-1' } as any, '25', '50');

    expect(service.getBlockedUsers).toHaveBeenCalledWith('user-1', 25, 50);
  });

  it.each([
    ['0', undefined],
    ['101', undefined],
    ['abc', undefined],
    [undefined, '-1'],
    [undefined, '10001'],
  ])('rejects invalid pagination limit=%s offset=%s', async (limit, offset) => {
    await expect(
      controller.getBlockedUsers({ id: 'user-1' } as any, limit, offset),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.getBlockedUsers).not.toHaveBeenCalled();
  });

  it('blocks a different user using a validated identifier', async () => {
    vi.mocked(service.blockUser).mockResolvedValue({ success: true });

    await expect(
      controller.blockUser({ id: 'user-1' } as any, { blocked_id: ' blocked-2 ' }),
    ).resolves.toEqual({ success: true });
    expect(service.blockUser).toHaveBeenCalledWith('user-1', 'blocked-2');
  });

  it('rejects missing or self-targeting block mutations', async () => {
    await expect(
      controller.blockUser({ id: 'user-1' } as any, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.blockUser({ id: 'user-1' } as any, { blocked_id: 'user-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.blockUser).not.toHaveBeenCalled();
  });

  it('unblocks a validated target', async () => {
    vi.mocked(service.unblockUser).mockResolvedValue({ success: true });

    const result = await controller.unblockUser({ id: 'user-1' } as any, ' blocked-2 ');

    expect(result).toEqual({ success: true });
    expect(service.unblockUser).toHaveBeenCalledWith('user-1', 'blocked-2');
  });

  it('requires authentication for all block-management operations', async () => {
    await expect(controller.getBlockedUsers(null)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.blockUser(null, { blocked_id: 'blocked-2' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(controller.unblockUser(null, 'blocked-2')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

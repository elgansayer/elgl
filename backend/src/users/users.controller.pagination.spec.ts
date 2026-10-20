import { BadRequestException } from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import type { MediaService } from '../media/media.service';
import { UsersController } from './users.controller';
import type { UsersService } from './users.service';

describe('UsersController pagination boundary', () => {
  const searchUsers = vi.fn();
  const getFollowers = vi.fn();
  const getFollowing = vi.fn();
  const usersService = {
    searchUsers,
    getFollowers,
    getFollowing,
  };
  const controller = new UsersController(
    usersService as unknown as UsersService,
    {} as MediaService,
  );
  const user = { id: 'user-1' } as User;

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('parses and forwards a bounded search limit', async () => {
    await controller.searchUsers('  learner  ', user, '100');

    expect(searchUsers).toHaveBeenCalledWith('learner', 'user-1', 100);
  });

  it.each(['0', '101', '1.5', '1e2', ' ', 'not-a-number'])(
    'rejects an invalid search limit of %s',
    async (limit) => {
      await expect(
        controller.searchUsers('learner', user, limit),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(searchUsers).not.toHaveBeenCalled();
    },
  );

  it('uses documented follower pagination defaults', async () => {
    await controller.getFollowers('profile-1', undefined, undefined, user);

    expect(getFollowers).toHaveBeenCalledWith('profile-1', 20, 0, 'user-1');
  });

  it('parses bounded following pagination values', async () => {
    await controller.getFollowing('profile-1', '25', '4', user);

    expect(getFollowing).toHaveBeenCalledWith('profile-1', 25, 4, 'user-1');
  });

  it.each([
    ['limit', '101', '0'],
    ['limit', '0', '0'],
    ['limit', '1.5', '0'],
    ['offset', '20', '-1'],
    ['offset', '20', '1.5'],
    ['offset', '20', '1e2'],
    ['offset', '20', ' '],
    ['offset', '20', '10001'],
  ])('rejects an invalid %s value', async (_name, limit, offset) => {
    await expect(
      controller.getFollowers('profile-1', limit, offset, user),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(getFollowers).not.toHaveBeenCalled();
  });
});

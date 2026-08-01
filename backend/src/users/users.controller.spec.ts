import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { MediaService } from '../media/media.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { TwoFactorGuard } from '../two-factor/two-factor.guard';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            getProfile: jest.fn(),
            updateProfile: jest.fn(),
            getFollowers: jest.fn(),
            getFollowing: jest.fn(),
            followUser: jest.fn(),
            unfollowUser: jest.fn(),
          },
        },
        {
          provide: MediaService,
          useValue: {
            generatePresignedUrl: jest.fn(),
            generateCoverPresignedUrl: jest.fn(),
            confirmCoverUpload: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(TwoFactorGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMyProfile', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.getMyProfile(null);
      expect(result).toBeNull();
      expect(usersService.getProfile).not.toHaveBeenCalled();
    });

    it('should return user profile when user is provided', async () => {
      const mockProfile: any = { id: 'user-1', display_name: 'Test User' };
      (usersService.getProfile as jest.Mock).mockResolvedValue(mockProfile);

      const result = await controller.getMyProfile({ id: 'user-1' } as any);
      expect(result).toEqual(mockProfile);
      expect(usersService.getProfile).toHaveBeenCalledWith('user-1');
    });
  });

  describe('updateMyProfile', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.updateMyProfile(null, {});
      expect(result).toBeNull();
      expect(usersService.getProfile).not.toHaveBeenCalled();
      expect(usersService.updateProfile).not.toHaveBeenCalled();
    });

    it('should update profile using is_vip status when profile exists', async () => {
      const mockUser = { id: 'user-1' } as any;
      const mockProfile: any = { id: 'user-1', is_vip: true };
      const dto: any = { display_name: 'New Name' };
      const updatedProfile: any = {
        id: 'user-1',
        display_name: 'New Name',
        is_vip: true,
      };

      (usersService.getProfile as jest.Mock).mockResolvedValue(mockProfile);
      (usersService.updateProfile as jest.Mock).mockResolvedValue(
        updatedProfile,
      );

      const result = await controller.updateMyProfile(mockUser, dto);

      expect(usersService.getProfile).toHaveBeenCalledWith('user-1');
      expect(usersService.updateProfile).toHaveBeenCalledWith(
        'user-1',
        dto,
        true,
      );
      expect(result).toEqual(updatedProfile);
    });

    it('should fall back to false when profile is_vip is undefined', async () => {
      const mockUser = { id: 'user-2' } as any;
      const mockProfile: any = { id: 'user-2' };
      const dto: any = { display_name: 'Updated Name' };
      const updatedProfile: any = {
        id: 'user-2',
        display_name: 'Updated Name',
      };

      (usersService.getProfile as jest.Mock).mockResolvedValue(mockProfile);
      (usersService.updateProfile as jest.Mock).mockResolvedValue(
        updatedProfile,
      );

      const result = await controller.updateMyProfile(mockUser, dto);

      expect(usersService.getProfile).toHaveBeenCalledWith('user-2');
      expect(usersService.updateProfile).toHaveBeenCalledWith(
        'user-2',
        dto,
        false,
      );
      expect(result).toEqual(updatedProfile);
    });
  });

  describe('getUserProfile', () => {
    it('should return profile for a specific user ID', async () => {
      const mockProfile: any = { id: 'target-user', display_name: 'Target' };
      (usersService.getProfile as jest.Mock).mockResolvedValue(mockProfile);

      const result = await controller.getUserProfile('target-user');
      expect(usersService.getProfile).toHaveBeenCalledWith('target-user');
      expect(result).toEqual(mockProfile);
    });
  });

  describe('getFollowers', () => {
    it('should apply default paging and forward the viewer id', async () => {
      const mockResult = { data: [{ id: 'follower-1' }], total: 1 } as any;
      (usersService.getFollowers as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.getFollowers(
        'target-user',
        undefined,
        undefined,
        { id: 'viewer-1' } as any,
      );

      expect(usersService.getFollowers).toHaveBeenCalledWith(
        'target-user',
        20,
        0,
        'viewer-1',
      );
      expect(result).toEqual(mockResult);
    });

    it('should pass through explicit limit/offset and a null viewer', async () => {
      const mockResult = { data: [], total: 0 } as any;
      (usersService.getFollowers as jest.Mock).mockResolvedValue(mockResult);

      await controller.getFollowers('target-user', 5, 10, null);

      expect(usersService.getFollowers).toHaveBeenCalledWith(
        'target-user',
        5,
        10,
        undefined,
      );
    });
  });

  describe('getFollowing', () => {
    it('should apply default paging and forward the viewer id', async () => {
      const mockResult = { data: [{ id: 'following-1' }], total: 1 } as any;
      (usersService.getFollowing as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.getFollowing(
        'target-user',
        undefined,
        undefined,
        { id: 'viewer-1' } as any,
      );

      expect(usersService.getFollowing).toHaveBeenCalledWith(
        'target-user',
        20,
        0,
        'viewer-1',
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('followUser', () => {
    it('should throw when no user is authenticated', async () => {
      await expect(controller.followUser('target-user', null)).rejects.toThrow(
        'Unauthorized',
      );
      expect(usersService.followUser).not.toHaveBeenCalled();
    });

    it('should follow the target user on behalf of the current user', async () => {
      await controller.followUser('target-user', { id: 'viewer-1' } as any);
      expect(usersService.followUser).toHaveBeenCalledWith(
        'viewer-1',
        'target-user',
      );
    });
  });

  describe('unfollowUser', () => {
    it('should throw when no user is authenticated', async () => {
      await expect(
        controller.unfollowUser('target-user', null),
      ).rejects.toThrow('Unauthorized');
      expect(usersService.unfollowUser).not.toHaveBeenCalled();
    });

    it('should unfollow the target user on behalf of the current user', async () => {
      await controller.unfollowUser('target-user', { id: 'viewer-1' } as any);
      expect(usersService.unfollowUser).toHaveBeenCalledWith(
        'viewer-1',
        'target-user',
      );
    });
  });
});

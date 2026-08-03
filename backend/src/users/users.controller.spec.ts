import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { MediaService } from '../media/media.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { TwoFactorGuard } from '../two-factor/two-factor.guard';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;
  let mediaService: MediaService;

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
            scheduleDeletion: jest.fn(),
            cancelDeletion: jest.fn(),
            exportUserData: jest.fn(),
            getUserStats: jest.fn(),
            getUserXp: jest.fn(),
            proficiencyAssessment: jest.fn(),
            getVisitors: jest.fn(),
            getStatusViewers: jest.fn(),
            getAvailableHobbies: jest.fn(),
            getAvailableInterests: jest.fn(),
            getBadges: jest.fn(),
            getPrivacySettings: jest.fn(),
            getMessageFilters: jest.fn(),
            setMessageFilters: jest.fn(),
            updatePrivacySettings: jest.fn(),
            getBusinessProfile: jest.fn(),
            updateBusinessProfile: jest.fn(),
            updateDoNotDisturbSettings: jest.fn(),
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
    mediaService = module.get<MediaService>(MediaService);
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

  describe('deleteMyAccount', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(controller.deleteMyAccount(null)).rejects.toThrow(
        'Unauthorized',
      );
      expect(usersService.scheduleDeletion).not.toHaveBeenCalled();
    });

    it('should call scheduleDeletion with the user id', async () => {
      const mockResult = {
        message: 'scheduled',
        scheduled_for_deletion_at: '2026-08-02',
      };
      (usersService.scheduleDeletion as jest.Mock).mockResolvedValue(
        mockResult,
      );
      const result = await controller.deleteMyAccount({ id: 'user-1' } as any);
      expect(usersService.scheduleDeletion).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockResult);
    });
  });

  describe('restoreMyAccount', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(controller.restoreMyAccount(null)).rejects.toThrow(
        'Unauthorized',
      );
      expect(usersService.cancelDeletion).not.toHaveBeenCalled();
    });

    it('should call cancelDeletion with the user id', async () => {
      (usersService.cancelDeletion as jest.Mock).mockResolvedValue({
        message: 'restored',
      });
      const result = await controller.restoreMyAccount({ id: 'user-1' } as any);
      expect(usersService.cancelDeletion).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ message: 'restored' });
    });
  });

  describe('exportMyData', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(controller.exportMyData(null)).rejects.toThrow(
        'Unauthorized',
      );
      expect(usersService.exportUserData).not.toHaveBeenCalled();
    });

    it('should call exportUserData with the user id', async () => {
      const mockExport = { profile: {}, moments: [] };
      (usersService.exportUserData as jest.Mock).mockResolvedValue(mockExport);
      const result = await controller.exportMyData({ id: 'user-1' } as any);
      expect(usersService.exportUserData).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockExport);
    });
  });

  describe('getMyStats', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(controller.getMyStats(null)).rejects.toThrow('Unauthorized');
      expect(usersService.getUserStats).not.toHaveBeenCalled();
    });

    it('should return stats for current user', async () => {
      const mockStats = { id: 'user-1', coins: 10 };
      (usersService.getUserStats as jest.Mock).mockResolvedValue(mockStats);
      const result = await controller.getMyStats({ id: 'user-1' } as any);
      expect(usersService.getUserStats).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockStats);
    });
  });

  describe('getMyXp', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(controller.getMyXp(null)).rejects.toThrow('Unauthorized');
      expect(usersService.getUserXp).not.toHaveBeenCalled();
    });

    it('should return total XP', async () => {
      (usersService.getUserXp as jest.Mock).mockResolvedValue(120);
      const result = await controller.getMyXp({ id: 'user-1' } as any);
      expect(usersService.getUserXp).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ totalXp: 120 });
    });
  });

  describe('assessProficiency', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(controller.assessProficiency(null, 50)).rejects.toThrow(
        'Unauthorized',
      );
      expect(usersService.proficiencyAssessment).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid score', async () => {
      await expect(
        controller.assessProficiency({ id: 'user-1' } as any, 101),
      ).rejects.toThrow('Bad Request');
      await expect(
        controller.assessProficiency({ id: 'user-1' } as any, -1),
      ).rejects.toThrow('Bad Request');
      await expect(
        controller.assessProficiency({ id: 'user-1' } as any, 'abc' as any),
      ).rejects.toThrow('Bad Request');
    });

    it('should call proficiencyAssessment and return level', async () => {
      (usersService.proficiencyAssessment as jest.Mock).mockResolvedValue('B1');
      const result = await controller.assessProficiency(
        { id: 'user-1' } as any,
        80,
      );
      expect(usersService.proficiencyAssessment).toHaveBeenCalledWith(
        'user-1',
        80,
      );
      expect(result).toEqual({ level: 'B1' });
    });
  });

  describe('getCoverPhotoPresignedUrl', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(
        controller.getCoverPhotoPresignedUrl(null, {
          filename: 'cover.jpg',
          contentType: 'image/jpeg',
        }),
      ).rejects.toThrow('Unauthorized');
      expect(mediaService.generatePresignedUrl).not.toHaveBeenCalled();
    });

    it('should call mediaService.generatePresignedUrl with cover-photos folder', async () => {
      const mockResult = {
        uploadUrl: 'https://example.com',
        mediaUrl: 'https://example.com',
        objectKey: 'key',
      };
      (mediaService.generatePresignedUrl as jest.Mock).mockResolvedValue(
        mockResult,
      );
      const result = await controller.getCoverPhotoPresignedUrl(
        { id: 'user-1' } as any,
        { filename: 'cover.jpg', contentType: 'image/jpeg' },
      );
      expect(mediaService.generatePresignedUrl).toHaveBeenCalledWith('user-1', {
        filename: 'cover.jpg',
        contentType: 'image/jpeg',
        folder: 'cover-photos',
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('updateCoverPhoto', () => {
    it('should return null when user is not provided', async () => {
      const result = await controller.updateCoverPhoto(null, 'url');
      expect(result).toBeNull();
      expect(usersService.getProfile).not.toHaveBeenCalled();
      expect(usersService.updateProfile).not.toHaveBeenCalled();
    });

    it('should pass is_vip true when profile has is_vip', async () => {
      const mockUser = { id: 'user-1' } as any;
      const mockProfile: any = { id: 'user-1', is_vip: true };
      (usersService.getProfile as jest.Mock).mockResolvedValue(mockProfile);
      (usersService.updateProfile as jest.Mock).mockResolvedValue({
        id: 'user-1',
        cover_photo_url: 'new-url',
      });

      await controller.updateCoverPhoto(mockUser, 'new-url');
      expect(usersService.updateProfile).toHaveBeenCalledWith(
        'user-1',
        { cover_photo_url: 'new-url' },
        true,
      );
    });

    it('should pass is_vip false when profile lacks is_vip', async () => {
      const mockUser = { id: 'user-2' } as any;
      const mockProfile: any = { id: 'user-2' };
      (usersService.getProfile as jest.Mock).mockResolvedValue(mockProfile);
      (usersService.updateProfile as jest.Mock).mockResolvedValue({
        id: 'user-2',
        cover_photo_url: 'new-url',
      });

      await controller.updateCoverPhoto(mockUser, 'new-url');
      expect(usersService.updateProfile).toHaveBeenCalledWith(
        'user-2',
        { cover_photo_url: 'new-url' },
        false,
      );
    });
  });

  describe('getAvatarPresignedUrl', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(
        controller.getAvatarPresignedUrl(null, {
          filename: 'a.png',
          contentType: 'image/png',
        }),
      ).rejects.toThrow('Unauthorized');
      expect(mediaService.generatePresignedUrl).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for disallowed content type', async () => {
      await expect(
        controller.getAvatarPresignedUrl({ id: 'user-1' } as any, {
          filename: 'a.gif',
          contentType: 'image/gif',
        }),
      ).rejects.toThrow('Bad Request');
      expect(mediaService.generatePresignedUrl).not.toHaveBeenCalled();
    });

    it('should call mediaService.generatePresignedUrl with avatars folder', async () => {
      const mockResult = {
        uploadUrl: 'https://example.com',
        mediaUrl: 'https://example.com',
        objectKey: 'key',
      };
      (mediaService.generatePresignedUrl as jest.Mock).mockResolvedValue(
        mockResult,
      );
      const result = await controller.getAvatarPresignedUrl(
        { id: 'user-1' } as any,
        { filename: 'a.png', contentType: 'image/png' },
      );
      expect(mediaService.generatePresignedUrl).toHaveBeenCalledWith('user-1', {
        filename: 'a.png',
        contentType: 'image/png',
        folder: 'avatars',
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('getMyVisitors', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(controller.getMyVisitors(null)).rejects.toThrow(
        'Unauthorized',
      );
      expect(usersService.getVisitors).not.toHaveBeenCalled();
    });

    it('should return visitors', async () => {
      const visitors = [{ id: 'v1', display_name: 'Visitor' }];
      (usersService.getVisitors as jest.Mock).mockResolvedValue(visitors);
      const result = await controller.getMyVisitors({ id: 'user-1' } as any);
      expect(usersService.getVisitors).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(visitors);
    });
  });

  describe('getMyStatusViewers', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(controller.getMyStatusViewers(null)).rejects.toThrow(
        'Unauthorized',
      );
      expect(usersService.getStatusViewers).not.toHaveBeenCalled();
    });

    it('should return status viewers', async () => {
      const viewers = [{ id: 'v1', display_name: 'Viewer' }];
      (usersService.getStatusViewers as jest.Mock).mockResolvedValue(viewers);
      const result = await controller.getMyStatusViewers({
        id: 'user-1',
      } as any);
      expect(usersService.getStatusViewers).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(viewers);
    });
  });

  describe('getAvailableHobbies', () => {
    it('should return hobbies list', () => {
      const hobbies = ['reading', 'gaming'];
      (usersService.getAvailableHobbies as jest.Mock).mockReturnValue(hobbies);
      expect(controller.getAvailableHobbies()).toEqual(hobbies);
    });
  });

  describe('getAvailableInterests', () => {
    it('should return interests list', () => {
      const interests = ['tech', 'music'];
      (usersService.getAvailableInterests as jest.Mock).mockReturnValue(
        interests,
      );
      expect(controller.getAvailableInterests()).toEqual(interests);
    });
  });

  describe('getMyBadges', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(controller.getMyBadges(null)).rejects.toThrow(
        'Unauthorized',
      );
      expect(usersService.getBadges).not.toHaveBeenCalled();
    });

    it('should return badges', async () => {
      const badges = [
        { id: 'badge-1', name: 'Early Bird', description: 'First day' },
      ];
      (usersService.getBadges as jest.Mock).mockResolvedValue(badges);
      const result = await controller.getMyBadges({ id: 'user-1' } as any);
      expect(usersService.getBadges).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(badges);
    });
  });

  describe('getUserStats', () => {
    it('should return stats for the given id', async () => {
      const stats = { id: 'target', coins: 5 };
      (usersService.getUserStats as jest.Mock).mockResolvedValue(stats);
      const result = await controller.getUserStats('target');
      expect(usersService.getUserStats).toHaveBeenCalledWith('target');
      expect(result).toEqual(stats);
    });
  });

  describe('getMyPrivacySettings', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(controller.getMyPrivacySettings(null)).rejects.toThrow(
        'Unauthorized',
      );
      expect(usersService.getPrivacySettings).not.toHaveBeenCalled();
    });

    it('should return privacy settings', async () => {
      const settings = { privacy_hide_age: true };
      (usersService.getPrivacySettings as jest.Mock).mockResolvedValue(
        settings,
      );
      const result = await controller.getMyPrivacySettings({
        id: 'user-1',
      } as any);
      expect(usersService.getPrivacySettings).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(settings);
    });
  });

  describe('getMyMessageFilters', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(controller.getMyMessageFilters(null)).rejects.toThrow(
        'Unauthorized',
      );
      expect(usersService.getMessageFilters).not.toHaveBeenCalled();
    });

    it('should return message filters', async () => {
      const filters = { age_min: 18, age_max: 99 };
      (usersService.getMessageFilters as jest.Mock).mockResolvedValue(filters);
      const result = await controller.getMyMessageFilters({
        id: 'user-1',
      } as any);
      expect(usersService.getMessageFilters).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(filters);
    });
  });

  describe('setMyMessageFilters', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(
        controller.setMyMessageFilters(null, { age_min: 18 }),
      ).rejects.toThrow('Unauthorized');
      expect(usersService.setMessageFilters).not.toHaveBeenCalled();
    });

    it('should call setMessageFilters with user id and filters', async () => {
      const filters = {
        age_min: 18,
        age_max: 99,
        allowed_native_languages: ['en'],
        allowed_genders: ['male'],
      };
      await controller.setMyMessageFilters({ id: 'user-1' } as any, filters);
      expect(usersService.setMessageFilters).toHaveBeenCalledWith(
        'user-1',
        filters,
      );
    });
  });

  describe('updatePrivacySettings', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(controller.updatePrivacySettings(null, {})).rejects.toThrow(
        'Unauthorized',
      );
      expect(usersService.updatePrivacySettings).not.toHaveBeenCalled();
    });

    it('should call updatePrivacySettings with DTO and the caller VIP status', async () => {
      const dto = { privacy_hide_age: true };
      (usersService.getProfile as jest.Mock).mockResolvedValue({
        id: 'user-1',
        is_vip: true,
      });
      (usersService.updatePrivacySettings as jest.Mock).mockResolvedValue({
        id: 'user-1',
      });
      const result = await controller.updatePrivacySettings(
        { id: 'user-1' } as any,
        dto,
      );
      expect(usersService.updatePrivacySettings).toHaveBeenCalledWith(
        'user-1',
        dto,
        true,
      );
      expect(result).toEqual({ id: 'user-1' });
    });
  });

  describe('getMyBusinessProfile', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(controller.getMyBusinessProfile(null)).rejects.toThrow(
        'Unauthorized',
      );
      expect(usersService.getBusinessProfile).not.toHaveBeenCalled();
    });

    it('should return business profile', async () => {
      const profile = { business_name: 'Acme' };
      (usersService.getBusinessProfile as jest.Mock).mockResolvedValue(profile);
      const result = await controller.getMyBusinessProfile({
        id: 'user-1',
      } as any);
      expect(usersService.getBusinessProfile).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(profile);
    });
  });

  describe('updateMyBusinessProfile', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(
        controller.updateMyBusinessProfile(null, {}),
      ).rejects.toThrow('Unauthorized');
      expect(usersService.updateBusinessProfile).not.toHaveBeenCalled();
    });

    it('should call updateBusinessProfile', async () => {
      const dto = { business_name: 'New' };
      (usersService.updateBusinessProfile as jest.Mock).mockResolvedValue({
        id: 'user-1',
        business_name: 'New',
      });
      const result = await controller.updateMyBusinessProfile(
        { id: 'user-1' } as any,
        dto,
      );
      expect(usersService.updateBusinessProfile).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual({ id: 'user-1', business_name: 'New' });
    });
  });

  describe('setDoNotDisturb', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(controller.setDoNotDisturb(null, {})).rejects.toThrow(
        'Unauthorized',
      );
      expect(usersService.updateDoNotDisturbSettings).not.toHaveBeenCalled();
    });

    it('should call updateDoNotDisturbSettings', async () => {
      const dto = { dnd_enabled: true };
      (usersService.updateDoNotDisturbSettings as jest.Mock).mockResolvedValue({
        id: 'user-1',
      });
      const result = await controller.setDoNotDisturb(
        { id: 'user-1' } as any,
        dto,
      );
      expect(usersService.updateDoNotDisturbSettings).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual({ id: 'user-1' });
    });
  });
});

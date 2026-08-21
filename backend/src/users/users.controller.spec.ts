import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { MediaService } from '../media/media.service';
import { ProfileVisitsService } from '../profile-visits/profile-visits.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { TwoFactorGuard } from '../two-factor/two-factor.guard';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;
  let mediaService: MediaService;
  let profileVisitsService: ProfileVisitsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            getProfile: vi.fn(),
            updateProfile: vi.fn(),
            getFollowers: vi.fn(),
            getFollowing: vi.fn(),
            followUser: vi.fn(),
            unfollowUser: vi.fn(),
            scheduleDeletion: vi.fn(),
            cancelDeletion: vi.fn(),
            exportUserData: vi.fn(),
            getUserStats: vi.fn(),
            getUserXp: vi.fn(),
            proficiencyAssessment: vi.fn(),
            getVisitors: vi.fn(),
            getStatusViewers: vi.fn(),
            getStatusViewersByStatusId: vi.fn(),
            getDefaultStatusId: vi.fn(),
            getAvailableHobbies: vi.fn(),
            getAvailableInterests: vi.fn(),
            getBadges: vi.fn(),
            getPrivacySettings: vi.fn(),
            getMessageFilters: vi.fn(),
            setMessageFilters: vi.fn(),
            updatePrivacySettings: vi.fn(),
            getBusinessProfile: vi.fn(),
            updateBusinessProfile: vi.fn(),
            updateDoNotDisturbSettings: vi.fn(),
            permanentDeleteAccount: vi.fn(),
            getNotificationPreferences: vi.fn(),
            updateGreetingMessage: vi.fn(),
            updateAwayMessage: vi.fn(),
            blockUser: vi.fn(),
            unblockUser: vi.fn(),
            reportUser: vi.fn(),
            updateNotificationPreferences: vi.fn(),
          },
        },
        {
          provide: MediaService,
          useValue: {
            generatePresignedUrl: vi.fn(),
            generateCoverPresignedUrl: vi.fn(),
            confirmCoverUpload: vi.fn(),
          },
        },
        {
          provide: ProfileVisitsService,
          useValue: {
            recordVisit: jest.fn(),
            getVisitors: jest.fn(),
            getVisitCount: jest.fn(),
            deleteVisit: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .overrideGuard(TwoFactorGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
    mediaService = module.get<MediaService>(MediaService);
    profileVisitsService = module.get<ProfileVisitsService>(ProfileVisitsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
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
      (usersService.getProfile as Mock).mockResolvedValue(mockProfile);

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

      (usersService.getProfile as Mock).mockResolvedValue(mockProfile);
      (usersService.updateProfile as Mock).mockResolvedValue(updatedProfile);

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

      (usersService.getProfile as Mock).mockResolvedValue(mockProfile);
      (usersService.updateProfile as Mock).mockResolvedValue(updatedProfile);

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

  describe('updateGreetingMessage', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(
        controller.updateGreetingMessage(null, { greetingMessage: 'Hi' }),
      ).rejects.toThrow('Unauthorized');
      expect(usersService.updateGreetingMessage).not.toHaveBeenCalled();
    });

    it('should call updateGreetingMessage with the user id and message', async () => {
      const updatedProfile: any = {
        id: 'user-1',
        greeting_message: 'Hello!',
      };
      (usersService.updateGreetingMessage as Mock).mockResolvedValue(
        updatedProfile,
      );
      const result = await controller.updateGreetingMessage(
        { id: 'user-1' } as any,
        { greetingMessage: 'Hello!' },
      );
      expect(usersService.updateGreetingMessage).toHaveBeenCalledWith(
        'user-1',
        'Hello!',
      );
      expect(result).toEqual(updatedProfile);
    });
  });

  describe('updateAwayMessage', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(
        controller.updateAwayMessage(null, { awayMessage: 'Away' }),
      ).rejects.toThrow('Unauthorized');
      expect(usersService.updateAwayMessage).not.toHaveBeenCalled();
    });

    it('should call updateAwayMessage with the user id and message', async () => {
      const updatedProfile: any = { id: 'user-1', away_message: 'Back soon' };
      (usersService.updateAwayMessage as Mock).mockResolvedValue(
        updatedProfile,
      );
      const result = await controller.updateAwayMessage(
        { id: 'user-1' } as any,
        { awayMessage: 'Back soon' },
      );
      expect(usersService.updateAwayMessage).toHaveBeenCalledWith(
        'user-1',
        'Back soon',
      );
      expect(result).toEqual(updatedProfile);
    });
  });

  describe('getUserProfile', () => {
    it('should return profile for a specific user ID', async () => {
      const mockProfile: any = {
        id: 'target-user',
        display_name: 'Target',
        profile_visibility: 'everyone',
      };
      (usersService.getProfile as Mock).mockResolvedValue(mockProfile);

      const result = await controller.getUserProfile('target-user', null);
      expect(usersService.getProfile).toHaveBeenCalledWith('target-user');
      expect(result).toEqual(mockProfile);
    });

    it('should reject hidden profile for unauthenticated user', async () => {
      const mockProfile: any = {
        id: 'target-user',
        display_name: 'Target',
        profile_visibility: 'hidden',
      };
      (usersService.getProfile as Mock).mockResolvedValue(mockProfile);

      await expect(
        controller.getUserProfile('target-user', null),
      ).rejects.toThrow('This profile is not visible');
    });

    it('should reject vips_only profile for non-VIP user', async () => {
      const mockTargetProfile: any = {
        id: 'target-user',
        display_name: 'Target',
        profile_visibility: 'vips_only',
        is_vip: false,
      };
      (usersService.getProfile as Mock).mockResolvedValueOnce(
        mockTargetProfile,
      );
      (usersService.getProfile as Mock).mockResolvedValueOnce({
        ...mockTargetProfile,
        is_vip: false,
      });

      await expect(
        controller.getUserProfile('target-user', {
          id: 'non-vip-user',
          is_vip: false,
        } as any),
      ).rejects.toThrow('This profile is visible to VIP members only');
    });

    it('should allow vips_only profile for VIP user', async () => {
      const mockTargetProfile: any = {
        id: 'target-user',
        display_name: 'Target',
        profile_visibility: 'vips_only',
      };
      (usersService.getProfile as Mock).mockResolvedValueOnce(
        mockTargetProfile,
      );
      (usersService.getProfile as Mock).mockResolvedValueOnce({
        ...mockTargetProfile,
        is_vip: true,
      });

      const result = await controller.getUserProfile('target-user', {
        id: 'vip-user',
        is_vip: true,
      } as any);
      expect(result).toEqual(mockTargetProfile);
    });
  });

  describe('getFollowers', () => {
    it('should apply default paging and forward the viewer id', async () => {
      const mockResult = { data: [{ id: 'follower-1' }], total: 1 } as any;
      (usersService.getFollowers as Mock).mockResolvedValue(mockResult);

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
      (usersService.getFollowers as Mock).mockResolvedValue(mockResult);

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
      (usersService.getFollowing as Mock).mockResolvedValue(mockResult);

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

  describe('blockUser', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(controller.blockUser(null, 'target-user')).rejects.toThrow(
        'Unauthorized',
      );
      expect(usersService.blockUser).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when blocking yourself', async () => {
      await expect(
        controller.blockUser({ id: 'user-1' } as any, 'user-1'),
      ).rejects.toThrow('Cannot block yourself');
      expect(usersService.blockUser).not.toHaveBeenCalled();
    });

    it('should block the target user on behalf of the current user', async () => {
      (usersService.blockUser as Mock).mockResolvedValue({
        success: true,
      });
      const result = await controller.blockUser(
        { id: 'user-1' } as any,
        'target-user',
      );
      expect(usersService.blockUser).toHaveBeenCalledWith(
        'user-1',
        'target-user',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('unblockUser', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(controller.unblockUser(null, 'target-user')).rejects.toThrow(
        'Unauthorized',
      );
      expect(usersService.unblockUser).not.toHaveBeenCalled();
    });

    it('should unblock the target user on behalf of the current user', async () => {
      (usersService.unblockUser as Mock).mockResolvedValue({
        success: true,
      });
      const result = await controller.unblockUser(
        { id: 'user-1' } as any,
        'target-user',
      );
      expect(usersService.unblockUser).toHaveBeenCalledWith(
        'user-1',
        'target-user',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('reportUser', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(
        controller.reportUser(null, {
          reported_id: 'target-user',
          reason_category: 'spam',
        }),
      ).rejects.toThrow('Unauthorized');
      expect(usersService.reportUser).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when required fields are missing', async () => {
      await expect(
        controller.reportUser({ id: 'user-1' } as any, {
          reported_id: '',
          reason_category: 'spam',
        }),
      ).rejects.toThrow('Bad Request');
      await expect(
        controller.reportUser({ id: 'user-1' } as any, {
          reported_id: 'target-user',
          reason_category: '',
        }),
      ).rejects.toThrow('Bad Request');
      expect(usersService.reportUser).not.toHaveBeenCalled();
    });

    it('should call reportUser with the reporter id and normalised dto', async () => {
      (usersService.reportUser as Mock).mockResolvedValue({
        success: true,
        message: 'Report submitted',
      });
      const result = await controller.reportUser({ id: 'user-1' } as any, {
        reported_id: 'target-user',
        reason_category: 'spam',
        description: 'unwanted messages',
        context_url: 'https://example.com/chat',
      });
      expect(usersService.reportUser).toHaveBeenCalledWith('user-1', {
        reported_id: 'target-user',
        reason_category: 'spam',
        description: 'unwanted messages',
        context_url: 'https://example.com/chat',
      });
      expect(result).toEqual({ success: true, message: 'Report submitted' });
    });

    it('should omit optional fields when not provided', async () => {
      (usersService.reportUser as Mock).mockResolvedValue({
        success: true,
        message: 'Report submitted',
      });
      await controller.reportUser({ id: 'user-1' } as any, {
        reported_id: 'target-user',
        reason_category: 'spam',
      });
      expect(usersService.reportUser).toHaveBeenCalledWith('user-1', {
        reported_id: 'target-user',
        reason_category: 'spam',
        description: undefined,
        context_url: undefined,
      });
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
      (usersService.scheduleDeletion as Mock).mockResolvedValue(mockResult);
      const result = await controller.deleteMyAccount({ id: 'user-1' } as any);
      expect(usersService.scheduleDeletion).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockResult);
    });
  });

  describe('permanentlyDeleteMyAccount', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(controller.permanentlyDeleteMyAccount(null)).rejects.toThrow(
        'Unauthorized',
      );
      expect(usersService.permanentDeleteAccount).not.toHaveBeenCalled();
    });

    it('should call permanentDeleteAccount with the user id', async () => {
      (usersService.permanentDeleteAccount as Mock).mockResolvedValue(
        undefined,
      );
      const result = await controller.permanentlyDeleteMyAccount({
        id: 'user-1',
      } as any);
      expect(usersService.permanentDeleteAccount).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual({ message: 'Account permanently deleted.' });
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
      (usersService.cancelDeletion as Mock).mockResolvedValue({
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
      (usersService.exportUserData as Mock).mockResolvedValue(mockExport);
      const result = await controller.exportMyData({ id: 'user-1' } as any);
      expect(usersService.exportUserData).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockExport);
    });
  });

  describe('getMyNotificationPreferences', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(
        controller.getMyNotificationPreferences(null),
      ).rejects.toThrow('Unauthorized');
      expect(usersService.getNotificationPreferences).not.toHaveBeenCalled();
    });

    it('should return notification preferences for current user', async () => {
      const prefs = { custom_tone_url: 'https://example.com/tone.mp3' };
      (usersService.getNotificationPreferences as Mock).mockResolvedValue(
        prefs,
      );
      const result = await controller.getMyNotificationPreferences({
        id: 'user-1',
      } as any);
      expect(usersService.getNotificationPreferences).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual(prefs);
    });
  });

  describe('getMyStats', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(controller.getMyStats(null)).rejects.toThrow('Unauthorized');
      expect(usersService.getUserStats).not.toHaveBeenCalled();
    });

    it('should return stats for current user', async () => {
      const mockStats = { id: 'user-1', coins: 10 };
      (usersService.getUserStats as Mock).mockResolvedValue(mockStats);
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
      (usersService.getUserXp as Mock).mockResolvedValue(120);
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
      (usersService.proficiencyAssessment as Mock).mockResolvedValue('B1');
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
      (mediaService.generatePresignedUrl as Mock).mockResolvedValue(mockResult);
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
      (usersService.getProfile as Mock).mockResolvedValue(mockProfile);
      (usersService.updateProfile as Mock).mockResolvedValue({
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
      (usersService.getProfile as Mock).mockResolvedValue(mockProfile);
      (usersService.updateProfile as Mock).mockResolvedValue({
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
      (mediaService.generatePresignedUrl as Mock).mockResolvedValue(mockResult);
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
      (usersService.getVisitors as Mock).mockResolvedValue(visitors);
      const result = await controller.getMyVisitors({ id: 'user-1' } as any);
      expect(usersService.getVisitors).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(visitors);
    });
  });

  describe('getVisitors (by :id)', () => {
    it('should throw UnauthorizedException when no current user', async () => {
      await expect(
        controller.getVisitors('target-id', null),
      ).rejects.toThrow('Unauthorized');
      expect(profileVisitsService.getVisitors).not.toHaveBeenCalled();
    });

    it('should return visitors using ProfileVisitsService when user requests their own visitors', async () => {
      const ownProfile: any = { id: 'user-1', is_vip: true };
      const visitors: any[] = [{ id: 'v1', is_blurred: false, created_at: '2026-01-01', visitor: {} }];
      (usersService.getProfile as jest.Mock).mockResolvedValue(ownProfile);
      (profileVisitsService.getVisitors as jest.Mock).mockResolvedValue(visitors);

      const result = await controller.getVisitors('user-1', { id: 'user-1' } as any);

      expect(usersService.getProfile).toHaveBeenCalledWith('user-1');
      expect(profileVisitsService.getVisitors).toHaveBeenCalledWith('user-1', true);
      expect(result).toEqual(visitors);
    });

    it('should deny access when fetching visitors of a hidden profile', async () => {
      const hiddenProfile: any = { id: 'target-id', profile_visibility: 'hidden' };
      (usersService.getProfile as jest.Mock).mockResolvedValue(hiddenProfile);

      await expect(
        controller.getVisitors('target-id', { id: 'user-1' } as any),
      ).rejects.toThrow('This profile is not visible');
    });

    it('should return visitors for another user when requester is VIP', async () => {
      const targetProfile: any = { id: 'target-id', profile_visibility: 'everyone' };
      const requesterProfile: any = { id: 'user-1', is_vip: true };
      const visitors: any[] = [{ id: 'v1', is_blurred: false, created_at: '2026-01-01', visitor: {} }];

      (usersService.getProfile as jest.Mock)
        .mockResolvedValueOnce(targetProfile)
        .mockResolvedValueOnce(requesterProfile);
      (profileVisitsService.getVisitors as jest.Mock).mockResolvedValue(visitors);

      const result = await controller.getVisitors('target-id', { id: 'user-1' } as any);

      expect(profileVisitsService.getVisitors).toHaveBeenCalledWith('target-id', true);
      expect(result).toEqual(visitors);
    });

    it('should return blurred visitors for another user when requester is not VIP', async () => {
      const targetProfile: any = { id: 'target-id', profile_visibility: 'everyone' };
      const requesterProfile: any = { id: 'user-1', is_vip: false };
      const visitors: any[] = [{ id: 'v1', is_blurred: true, created_at: '2026-01-01', visitor: { id: 'hidden-vip-only', display_name: 'Someone near you' } }];

      (usersService.getProfile as jest.Mock)
        .mockResolvedValueOnce(targetProfile)
        .mockResolvedValueOnce(requesterProfile);
      (profileVisitsService.getVisitors as jest.Mock).mockResolvedValue(visitors);

      const result = await controller.getVisitors('target-id', { id: 'user-1' } as any);

      expect(profileVisitsService.getVisitors).toHaveBeenCalledWith('target-id', false);
      expect(result).toEqual(visitors);
    });
  });

  describe('getMyStatusViewers', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(controller.getMyStatusViewers(null)).rejects.toThrow(
        'Unauthorized',
      );
      expect(usersService.getDefaultStatusId).not.toHaveBeenCalled();
      expect(usersService.getStatusViewersByStatusId).not.toHaveBeenCalled();
    });

    it('should resolve the default status id and return its viewers', async () => {
      const viewers = [{ id: 'v1', display_name: 'Viewer' }];
      (usersService.getDefaultStatusId as Mock).mockResolvedValue('status-1');
      (usersService.getStatusViewersByStatusId as Mock).mockResolvedValue(
        viewers,
      );
      const result = await controller.getMyStatusViewers({
        id: 'user-1',
      } as any);
      expect(usersService.getDefaultStatusId).toHaveBeenCalledWith('user-1');
      expect(usersService.getStatusViewersByStatusId).toHaveBeenCalledWith(
        'user-1',
        'status-1',
      );
      expect(result).toEqual(viewers);
    });
  });

  describe('getStatusViewers', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(
        controller.getStatusViewers(null, 'status-1'),
      ).rejects.toThrow('Unauthorized');
      expect(usersService.getStatusViewersByStatusId).not.toHaveBeenCalled();
    });

    it('should return viewers for the given status id', async () => {
      const viewers = [{ id: 'v1', display_name: 'Viewer' }];
      (usersService.getStatusViewersByStatusId as Mock).mockResolvedValue(
        viewers,
      );
      const result = await controller.getStatusViewers(
        { id: 'user-1' } as any,
        'status-1',
      );
      expect(usersService.getStatusViewersByStatusId).toHaveBeenCalledWith(
        'user-1',
        'status-1',
      );
      expect(result).toEqual(viewers);
    });
  });

  describe('getAvailableHobbies', () => {
    it('should return hobbies list', () => {
      const hobbies = ['reading', 'gaming'];
      (usersService.getAvailableHobbies as Mock).mockReturnValue(hobbies);
      expect(controller.getAvailableHobbies()).toEqual(hobbies);
    });
  });

  describe('getAvailableInterests', () => {
    it('should return interests list', () => {
      const interests = ['tech', 'music'];
      (usersService.getAvailableInterests as Mock).mockReturnValue(interests);
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
      (usersService.getBadges as Mock).mockResolvedValue(badges);
      const result = await controller.getMyBadges({ id: 'user-1' } as any);
      expect(usersService.getBadges).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(badges);
    });
  });

  describe('getUserStats', () => {
    it('should return stats for the given id', async () => {
      const stats = { id: 'target', coins: 5 };
      (usersService.getUserStats as Mock).mockResolvedValue(stats);
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
      (usersService.getPrivacySettings as Mock).mockResolvedValue(settings);
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
      (usersService.getMessageFilters as Mock).mockResolvedValue(filters);
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
      const dto = { incognito_visits: true };
      (usersService.getProfile as Mock).mockResolvedValue({
        id: 'user-1',
        is_vip: true,
      });
      (usersService.updatePrivacySettings as Mock).mockResolvedValue({
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
      (usersService.getBusinessProfile as Mock).mockResolvedValue(profile);
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
      (usersService.updateBusinessProfile as Mock).mockResolvedValue({
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
      const dto = { do_not_disturb: true };
      (usersService.updateDoNotDisturbSettings as Mock).mockResolvedValue({
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

  describe('updateStatusVisibility', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(
        controller.updateStatusVisibility(null, {
          status_visibility: 'public',
        }),
      ).rejects.toThrow('Unauthorized');
      expect(usersService.updatePrivacySettings).not.toHaveBeenCalled();
    });

    it('should update status visibility using the caller VIP status', async () => {
      (usersService.getProfile as Mock).mockResolvedValue({
        id: 'user-1',
        is_vip: true,
      });
      (usersService.updatePrivacySettings as Mock).mockResolvedValue({
        id: 'user-1',
        status_visibility: 'followers',
      });
      const result = await controller.updateStatusVisibility(
        { id: 'user-1' } as any,
        { status_visibility: 'followers' },
      );
      expect(usersService.getProfile).toHaveBeenCalledWith('user-1');
      expect(usersService.updatePrivacySettings).toHaveBeenCalledWith(
        'user-1',
        { status_visibility: 'followers' },
        true,
      );
      expect(result).toEqual({
        id: 'user-1',
        status_visibility: 'followers',
      });
    });

    it('should fall back to false when profile is_vip is undefined', async () => {
      (usersService.getProfile as Mock).mockResolvedValue({
        id: 'user-2',
      });
      (usersService.updatePrivacySettings as Mock).mockResolvedValue({
        id: 'user-2',
        status_visibility: 'only_me',
      });
      await controller.updateStatusVisibility({ id: 'user-2' } as any, {
        status_visibility: 'only_me',
      });
      expect(usersService.updatePrivacySettings).toHaveBeenCalledWith(
        'user-2',
        { status_visibility: 'only_me' },
        false,
      );
    });
  });

  describe('updateNotificationPreferences', () => {
    it('should throw UnauthorizedException when no user', async () => {
      await expect(
        controller.updateNotificationPreferences(null, {}),
      ).rejects.toThrow('Unauthorized');
      expect(usersService.updateNotificationPreferences).not.toHaveBeenCalled();
    });

    it('should call updateNotificationPreferences with the user id and dto', async () => {
      const dto = {
        custom_tone_url: 'https://example.com/tone.mp3',
        vibration_pattern: [100, 200, 100],
      };
      const updatedProfile: any = { id: 'user-1', ...dto };
      (usersService.updateNotificationPreferences as Mock).mockResolvedValue(
        updatedProfile,
      );
      const result = await controller.updateNotificationPreferences(
        { id: 'user-1' } as any,
        dto,
      );
      expect(usersService.updateNotificationPreferences).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(updatedProfile);
    });
  });

  describe('throttle configuration for account lifecycle endpoints', () => {
    // Metadata keys used by @nestjs/throttler for the default named throttler.
    const throttleLimitKey = 'THROTTLER:LIMITdefault';
    const throttleTtlKey = 'THROTTLER:TTLdefault';

    const throttledEndpoints: Array<{
      method: keyof UsersController;
      limit: number;
      ttl: number;
    }> = [
      { method: 'deleteMyAccount', limit: 3, ttl: 60000 },
      { method: 'permanentlyDeleteMyAccount', limit: 2, ttl: 300000 },
      { method: 'restoreMyAccount', limit: 3, ttl: 60000 },
    ];

    it.each(throttledEndpoints)(
      'should limit $method to $limit requests per $ttl ms window',
      ({ method, limit, ttl }) => {
        const handler = UsersController.prototype[method];

        expect(Reflect.getMetadata(throttleLimitKey, handler)).toBe(limit);
        expect(Reflect.getMetadata(throttleTtlKey, handler)).toBe(ttl);
      },
    );
  });
});

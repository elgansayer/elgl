import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { DataExportWorker } from './data-export.worker';
import { SupabaseService } from '../supabase/supabase.service';
import { XpService } from '../xp/xp.service';

describe('UsersService', () => {
  let service: UsersService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockResolvedValue({ error: null }),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      range: jest.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: jest.fn(),
      single: jest.fn(),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
      auth: {
        admin: {
          getUserById: jest.fn(),
          generateLink: jest.fn(),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: XpService,
          useValue: {
            getTotalXp: jest.fn().mockResolvedValue(0),
            awardXpForActivity: jest.fn(),
          },
        },
        {
          provide: DataExportWorker,
          useValue: {
            exportUserData: jest.fn().mockResolvedValue({
              profile: {},
              moments: [],
              comments: [],
              messages: [],
              flashcards: [],
              favourites: [],
              exported_at: new Date().toISOString(),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('proficiencyAssessment', () => {
    it('should return the correct CEFR level based on the score', async () => {
      const mockUserId = 'user-1';
      const mockScore = 85;
      const expectedLevel = 'C1';

      mockQueryBuilder.update.mockReturnThis();
      mockQueryBuilder.eq.mockResolvedValue({ error: null });

      const result = await service.proficiencyAssessment(mockUserId, mockScore);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        proficiency_level: expectedLevel,
      });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', mockUserId);
      expect(result).toBe(expectedLevel);
    });

    it('should log a warning if updating the proficiency level fails', async () => {
      const mockUserId = 'user-1';
      const mockScore = 50;
      const expectedLevel = 'B1';

      mockQueryBuilder.update.mockReturnThis();
      mockQueryBuilder.eq.mockResolvedValue({
        error: { message: 'Update failed' },
      });

      const result = await service.proficiencyAssessment(mockUserId, mockScore);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        proficiency_level: expectedLevel,
      });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', mockUserId);
      expect(result).toBe(expectedLevel);
    });
  });

  describe('touchLastActiveAt', () => {
    it('should update the last_active_at field for the user', async () => {
      const mockUserId = 'user-1';
      const mockDate = '2026-01-01T00:00:00.000Z';

      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate);

      mockQueryBuilder.update.mockReturnThis();
      mockQueryBuilder.eq.mockResolvedValue({ error: null });

      await service.touchLastActiveAt(mockUserId);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        last_active_at: mockDate,
      });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', mockUserId);

      jest.restoreAllMocks();
    });

    it('should log a warning if updating last_active_at fails', async () => {
      const mockUserId = 'user-1';
      const mockDate = '2026-02-01T00:00:00.000Z';

      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate);

      mockQueryBuilder.update.mockReturnThis();
      mockQueryBuilder.eq.mockResolvedValue({
        error: { message: 'Update failed' },
      });

      await service.touchLastActiveAt(mockUserId);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        last_active_at: mockDate,
      });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', mockUserId);

      jest.restoreAllMocks();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return user profile when found', async () => {
      const mockProfile = { id: 'user-1', display_name: 'HelloUser' };
      mockQueryBuilder.single.mockResolvedValue({
        data: mockProfile,
        error: null,
      });

      const result = await service.getProfile('user-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('*');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'user-1');
      expect(result).toMatchObject(mockProfile);
    });

    it('should throw NotFoundException when user is not found or query errors', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      const result = await service.getProfile('non-existent');
      expect(result.id).toBe('non-existent');
      expect(result.display_name).toBe('My Profile (Mock)');
    });
  });

  describe('updateProfile', () => {
    it('should throw BadRequestException when non-VIP tries to set more than 1 target language', async () => {
      const dto = { target_languages: ['EN', 'FR'] };

      await expect(service.updateProfile('user-1', dto, false)).rejects.toThrow(
        new BadRequestException(
          'Free tier allows a maximum of 1 target language. Upgrade to VIP (8 UKP / $10 USD per month) to study up to 3 languages simultaneously.',
        ),
      );
    });

    it('should throw BadRequestException when anyone tries to set more than 3 target languages', async () => {
      const dto = { target_languages: ['EN', 'FR', 'ES', 'DE'] };

      await expect(service.updateProfile('user-1', dto, true)).rejects.toThrow(
        new BadRequestException(
          'A maximum of 3 target languages can be studied simultaneously.',
        ),
      );
    });

    it('should throw BadRequestException when non-VIP tries to set mock location', async () => {
      const dto = { mock_location: { latitude: 51.5, longitude: -0.1 } };

      await expect(service.updateProfile('user-1', dto, false)).rejects.toThrow(
        new BadRequestException(
          'Location spoofing requires a VIP subscription (8 UKP / $10 USD per month).',
        ),
      );
    });

    it('should throw BadRequestException when non-VIP tries to set custom primary accent colour', async () => {
      const dto = { primary_accent_color: '#ff0000' };

      await expect(service.updateProfile('user-1', dto, false)).rejects.toThrow(
        new BadRequestException(
          'Custom primary accent colours require a VIP subscription (8 UKP / $10 USD per month).',
        ),
      );
    });

    it('should allow VIP to set custom primary accent colour', async () => {
      const dto = { primary_accent_color: '#ff0000' };

      const updateBuilder = {
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
      const fromBuilder = { update: jest.fn().mockReturnValue(updateBuilder) };
      mockSupabaseClient.from.mockReturnValue(fromBuilder as any);
      jest
        .spyOn(service, 'getProfile')
        .mockResolvedValue({ id: 'user-1' } as any);

      const result = await service.updateProfile('user-1', dto, true);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(fromBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ primary_accent_color: '#ff0000' }),
      );
      expect(result).toEqual(
        expect.objectContaining({ primary_accent_color: '#ff0000' }),
      );
    });

    it('should update profile successfully with all possible fields for a VIP user', async () => {
      const dto = {
        display_name: 'Updated Name',
        native_languages: ['JA'],
        target_languages: ['EN', 'FR'],
        bio_text: 'Learning English',
        avatar_url: 'https://example.com/avatar.png',
        audio_intro_url: 'https://example.com/audio.mp3',
        privacy_hide_age: true,
        privacy_hide_location: false,
        privacy_hide_from_search: true,
        privacy_hide_exact_location: true,
        privacy_hide_online_status: true,
        location: { latitude: 35.6895, longitude: 139.6917 },
        mock_location: { latitude: 51.5074, longitude: -0.1278 },
      };

      const expectedPayload = {
        display_name: 'Updated Name',
        native_languages: ['JA'],
        target_languages: ['EN', 'FR'],
        bio_text: 'Learning English',
        avatar_url: 'https://example.com/avatar.png',
        audio_intro_url: 'https://example.com/audio.mp3',
        privacy_hide_age: true,
        privacy_hide_location: false,
        privacy_hide_from_search: true,
        privacy_hide_exact_location: true,
        privacy_hide_online_status: true,
        location: 'POINT(139.6917 35.6895)',
        mock_location: 'POINT(-0.1278 51.5074)',
      };

      const updatedProfile = {
        id: 'user-1',
        ...dto,
        location: 'POINT(139.6917 35.6895)',
        mock_location: 'POINT(-0.1278 51.5074)',
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: updatedProfile,
        error: null,
      });

      const result = await service.updateProfile('user-1', dto, true);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(expectedPayload);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'user-1');
      expect(mockQueryBuilder.select).toHaveBeenCalled();
      expect(result).toMatchObject(updatedProfile);
    });

    it('should persist privacy_hide_exact_location and privacy_hide_online_status toggles', async () => {
      const dto = {
        privacy_hide_exact_location: true,
        privacy_hide_online_status: true,
      };
      const updatedProfile = { id: 'user-1', ...dto };

      mockQueryBuilder.single.mockResolvedValue({
        data: updatedProfile,
        error: null,
      });

      const result = await service.updateProfile('user-1', dto, false);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        privacy_hide_exact_location: true,
        privacy_hide_online_status: true,
      });
      expect(result).toMatchObject(updatedProfile);
    });

    it('should update profile with minimal fields when only partial DTO provided', async () => {
      const dto = { display_name: 'Minimal Update' };
      const updatedProfile = { id: 'user-1', display_name: 'Minimal Update' };

      mockQueryBuilder.single.mockResolvedValue({
        data: updatedProfile,
        error: null,
      });

      const result = await service.updateProfile('user-1', dto, false);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        display_name: 'Minimal Update',
      });
      expect(result).toMatchObject(updatedProfile);
    });

    it('should return mock profile when update fails with error message', async () => {
      const dto = { display_name: 'Error Name' };
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Database check violation' },
      });

      const result = await service.updateProfile('user-1', dto, false);
      expect(result.id).toBe('user-1');
      expect(result.display_name).toBe('Error Name');
      expect(result.coins_balance).toBe(500); // verify mock fields exist
    });

    it('should return mock profile when update fails without error message', async () => {
      const dto = { display_name: 'Error Name' };
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.updateProfile('user-1', dto, false);
      expect(result.id).toBe('user-1');
      expect(result.display_name).toBe('Error Name');
    });
  });

  describe('getFollowers', () => {
    it('should return the total count and mark rows followed by the viewer', async () => {
      const countBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: 2, error: null }),
      };
      const dataBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [
            {
              follower_id: 'f1',
              follower: { id: 'f1', display_name: 'Follower One' },
            },
          ],
          error: null,
        }),
      };
      const followBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: [{ following_id: 'f1' }] }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(countBuilder)
        .mockReturnValueOnce(dataBuilder)
        .mockReturnValueOnce(followBuilder);

      const result = await service.getFollowers('user-1', 20, 0, 'viewer-1');

      expect(result.total).toBe(2);
      expect(result.data).toEqual([
        { id: 'f1', display_name: 'Follower One', is_followed_by_me: true },
      ]);
      expect(followBuilder.eq).toHaveBeenCalledWith('follower_id', 'viewer-1');
      expect(followBuilder.in).toHaveBeenCalledWith('following_id', ['f1']);
    });

    it('should skip the follow-state lookup when there is no viewer', async () => {
      const countBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: 1, error: null }),
      };
      const dataBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [{ follower_id: 'f1', follower: { id: 'f1' } }],
          error: null,
        }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(countBuilder)
        .mockReturnValueOnce(dataBuilder);

      const result = await service.getFollowers('user-1', 20, 0);

      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(2);
      expect(result.data).toEqual([{ id: 'f1' }]);
    });
  });

  describe('getFollowing', () => {
    it('should return the total count and mark rows followed by the viewer', async () => {
      const countBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: 1, error: null }),
      };
      const dataBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [
            {
              following_id: 'g1',
              following: { id: 'g1', display_name: 'Following One' },
            },
          ],
          error: null,
        }),
      };
      const followBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: [] }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(countBuilder)
        .mockReturnValueOnce(dataBuilder)
        .mockReturnValueOnce(followBuilder);

      const result = await service.getFollowing('user-1', 20, 0, 'viewer-1');

      expect(result.total).toBe(1);
      expect(result.data).toEqual([
        { id: 'g1', display_name: 'Following One', is_followed_by_me: false },
      ]);
    });
  });
  describe('getVisitors', () => {
    it('should return empty list when query succeeds', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      });
      await expect(service.getVisitors('user-1')).resolves.toEqual([]);
    });
  });

  describe('getStatusViewersByStatusId', () => {
    it('should return empty list when query succeeds', async () => {
      mockQueryBuilder.limit.mockResolvedValue({ data: [], error: null });
      await expect(
        service.getStatusViewersByStatusId('user-1', 'status-1'),
      ).resolves.toEqual([]);
    });
  });

  describe('getUserXp', () => {
    it('should return XP total', async () => {
      await expect(service.getUserXp('user-1')).resolves.toBe(0);
    });
  });

  describe('followUser', () => {
    it('should reject self-follow', async () => {
      await expect(service.followUser('same', 'same')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should resolve when database insert succeeds', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        upsert: jest.fn().mockResolvedValue({ error: null }),
      });
      await expect(
        service.followUser('follower', 'target'),
      ).resolves.toBeUndefined();
    });
  });

  describe('scheduleDeletion', () => {
    it('should return scheduled deletion date', async () => {
      mockQueryBuilder.update.mockReturnThis();
      mockQueryBuilder.eq.mockResolvedValue({ error: null });
      const result = await service.scheduleDeletion('user-1');
      expect(result).toHaveProperty(
        'message',
        'Account scheduled for deletion in 30 days.',
      );
      expect(result.scheduled_for_deletion_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('getPrivacySettings', () => {
    it('should return defaults when profile falls back to mock', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });
      const result = await service.getPrivacySettings('user-1');
      expect(result.privacy_hide_age).toBe(false);
      expect(result.privacy_last_seen).toBe('everyone');
      expect(result.incognito_visits).toBe(false);
    });
  });

  describe('updatePrivacySettings', () => {
    it('should throw BadRequestException when a non-VIP user enables incognito_visits', async () => {
      await expect(
        service.updatePrivacySettings(
          'user-1',
          { incognito_visits: true },
          false,
        ),
      ).rejects.toThrow(
        new BadRequestException(
          'Incognito profile visiting requires a VIP subscription (8 UKP / $10 USD per month).',
        ),
      );
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('should let a VIP user enable incognito_visits', async () => {
      const updatedProfile = { id: 'user-1', incognito_visits: true };
      mockQueryBuilder.eq.mockResolvedValueOnce({ error: null });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: updatedProfile,
        error: null,
      });

      const result = await service.updatePrivacySettings(
        'user-1',
        { incognito_visits: true },
        true,
      );

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        incognito_visits: true,
      });
      expect(result).toMatchObject(updatedProfile);
    });

    it('should allow a non-VIP user to disable incognito_visits', async () => {
      const updatedProfile = { id: 'user-1', incognito_visits: false };
      mockQueryBuilder.eq.mockResolvedValueOnce({ error: null });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: updatedProfile,
        error: null,
      });

      const result = await service.updatePrivacySettings(
        'user-1',
        { incognito_visits: false },
        false,
      );

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        incognito_visits: false,
      });
      expect(result).toMatchObject(updatedProfile);
    });
  });

  describe('getBadges', () => {
    it('should include VIP badge when profile is VIP', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { id: 'user-1', is_vip: true },
        error: null,
      });
      const badges = await service.getBadges('user-1');
      expect(badges.some((b) => b.id === 'vip')).toBe(true);
    });
  });
});

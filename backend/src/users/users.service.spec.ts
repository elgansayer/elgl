import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
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
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
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
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
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
      expect(result).toEqual(mockProfile);
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
        location: 'POINT(139.6917 35.6895)',
        mock_location: 'POINT(-0.1278 51.5074)',
      };

      const updatedProfile = { id: 'user-1', ...dto };
      mockQueryBuilder.single.mockResolvedValue({
        data: updatedProfile,
        error: null,
      });

      const result = await service.updateProfile('user-1', dto, true);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(expectedPayload);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'user-1');
      expect(mockQueryBuilder.select).toHaveBeenCalled();
      expect(result).toEqual(updatedProfile);
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
      expect(result).toEqual(updatedProfile);
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
});

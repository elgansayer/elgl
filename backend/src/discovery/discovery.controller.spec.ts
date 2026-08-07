import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@supabase/supabase-js';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { UsersService } from '../users/users.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { DiscoveryRateLimiterGuard } from './discovery-rate-limiter.guard';
import { UserProfile } from '../users/interfaces/user-profile.interface';
import { SearchQueryDto } from './dto/search-query.dto';
import { LanguagePairQueryDto } from './dto/language-pair-query.dto';

describe('DiscoveryController', () => {
  let controller: DiscoveryController;
  let discoveryService: jest.Mocked<DiscoveryService>;
  let usersService: jest.Mocked<UsersService>;

  const mockUser = { id: 'user-1', email: 'test@test.com', role: 'user' } as unknown as User;
  const mockProfile: Partial<UserProfile> = { id: 'user-1', display_name: 'Test' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DiscoveryController],
      providers: [
        {
          provide: DiscoveryService,
          useValue: {
            searchPartners: jest.fn(),
            getPartnerOfWeekIds: jest.fn(),
            getAudioIntros: jest.fn(),
            getRecentNativeSpeakers: jest.fn(),
            getSpotlightUsers: jest.fn(),
            findByLanguagePair: jest.fn(),
            searchByCountryCity: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getProfile: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(DiscoveryRateLimiterGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<DiscoveryController>(DiscoveryController);
    discoveryService = module.get(DiscoveryService);
    usersService = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // findPartners
  // ---------------------------------------------------------------------------
  describe('findPartners', () => {
    it('should return empty array if user is not provided', async () => {
      const result = await controller.findPartners(null, {} as SearchQueryDto);
      expect(result).toEqual([]);
      expect(usersService.getProfile).not.toHaveBeenCalled();
      expect(discoveryService.searchPartners).not.toHaveBeenCalled();
    });

    it('should get user profile and search partners when user is provided', async () => {
      const mockPartners: Partial<UserProfile>[] = [{ id: 'partner-1' }];
      const query: Partial<SearchQueryDto> = { native_languages: 'JA' };

      usersService.getProfile.mockResolvedValue(mockProfile as UserProfile);
      discoveryService.searchPartners.mockResolvedValue(
        mockPartners as UserProfile[],
      );

      const result = await controller.findPartners(mockUser, query as SearchQueryDto);

      expect(usersService.getProfile).toHaveBeenCalledWith('user-1');
      expect(discoveryService.searchPartners).toHaveBeenCalledWith(
        'user-1',
        mockProfile,
        query,
      );
      expect(result).toEqual(mockPartners);
    });

    it('should enable serious_learner_mode in query when profile has is_serious_learner', async () => {
      const seriousProfile = {
        ...mockProfile,
        is_serious_learner: true,
      };
      const query: Partial<SearchQueryDto> = {};
      const mockPartners: Partial<UserProfile>[] = [{ id: 'p1' }];

      usersService.getProfile.mockResolvedValue(seriousProfile as UserProfile);
      discoveryService.searchPartners.mockResolvedValue(
        mockPartners as UserProfile[],
      );

      await controller.findPartners(mockUser, query as SearchQueryDto);

      expect(query.serious_learner_mode).toBe(true);
    });

    it('should NOT set serious_learner_mode when profile is not a serious learner', async () => {
      const normalProfile = {
        ...mockProfile,
        is_serious_learner: false,
      };
      const query: Partial<SearchQueryDto> = {};

      usersService.getProfile.mockResolvedValue(normalProfile as UserProfile);
      discoveryService.searchPartners.mockResolvedValue([]);

      await controller.findPartners(mockUser, query as SearchQueryDto);

      expect(query.serious_learner_mode).toBeUndefined();
    });

    it('should NOT set serious_learner_mode when profile is null', async () => {
      const query: Partial<SearchQueryDto> = {};

      usersService.getProfile.mockResolvedValue(null);
      discoveryService.searchPartners.mockResolvedValue([]);

      await controller.findPartners(mockUser, query as SearchQueryDto);

      expect(query.serious_learner_mode).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // getPartnerOfWeek
  // ---------------------------------------------------------------------------
  describe('getPartnerOfWeek', () => {
    it('should return partner of week IDs from the service', async () => {
      const mockIds = ['id-a', 'id-b'];
      discoveryService.getPartnerOfWeekIds.mockResolvedValue(mockIds);

      const result = await controller.getPartnerOfWeek();

      expect(result).toEqual(mockIds);
      expect(discoveryService.getPartnerOfWeekIds).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no partners of week', async () => {
      discoveryService.getPartnerOfWeekIds.mockResolvedValue([]);

      const result = await controller.getPartnerOfWeek();

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getAudioIntros
  // ---------------------------------------------------------------------------
  describe('getAudioIntros', () => {
    it('should return empty array if user is not provided', async () => {
      const result = await controller.getAudioIntros(null, {} as SearchQueryDto);
      expect(result).toEqual([]);
      expect(discoveryService.getAudioIntros).not.toHaveBeenCalled();
    });

    it('should delegate to discovery service with user profile and query', async () => {
      const mockResults: Partial<UserProfile>[] = [{ id: 'p1', audio_intro_url: 'https://...' }];
      const query: Partial<SearchQueryDto> = { native_languages: 'ES' };

      usersService.getProfile.mockResolvedValue(mockProfile as UserProfile);
      discoveryService.getAudioIntros.mockResolvedValue(
        mockResults as UserProfile[],
      );

      const result = await controller.getAudioIntros(mockUser, query as SearchQueryDto);

      expect(usersService.getProfile).toHaveBeenCalledWith('user-1');
      expect(discoveryService.getAudioIntros).toHaveBeenCalledWith(
        'user-1',
        mockProfile,
        query,
      );
      expect(result).toEqual(mockResults);
    });
  });

  // ---------------------------------------------------------------------------
  // getRecentNativeSpeakers
  // ---------------------------------------------------------------------------
  describe('getRecentNativeSpeakers', () => {
    it('should return empty array if user is not provided', async () => {
      const result = await controller.getRecentNativeSpeakers(null);
      expect(result).toEqual([]);
      expect(discoveryService.getRecentNativeSpeakers).not.toHaveBeenCalled();
    });

    it('should delegate to discovery service with user id', async () => {
      const mockResults: Partial<UserProfile>[] = [
        { id: 'p1', native_languages: ['ja'] },
        { id: 'p2', native_languages: ['ko'] },
      ];

      discoveryService.getRecentNativeSpeakers.mockResolvedValue(
        mockResults as UserProfile[],
      );

      const result = await controller.getRecentNativeSpeakers(mockUser);

      expect(discoveryService.getRecentNativeSpeakers).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual(mockResults);
    });
  });

  // ---------------------------------------------------------------------------
  // getSpotlight
  // ---------------------------------------------------------------------------
  describe('getSpotlight', () => {
    it('should return empty array if user is not provided', async () => {
      const result = await controller.getSpotlight(null);
      expect(result).toEqual([]);
      expect(discoveryService.getSpotlightUsers).not.toHaveBeenCalled();
    });

    it('should delegate to discovery service with user id', async () => {
      const mockResults: Partial<UserProfile>[] = [
        { id: 'p1', is_vip: true },
        { id: 'p2', is_vip: false },
      ];

      discoveryService.getSpotlightUsers.mockResolvedValue(
        mockResults as UserProfile[],
      );

      const result = await controller.getSpotlight(mockUser);

      expect(discoveryService.getSpotlightUsers).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockResults);
    });
  });

  // ---------------------------------------------------------------------------
  // findByLanguagePair
  // ---------------------------------------------------------------------------
  describe('findByLanguagePair', () => {
    it('should return empty array if user is not provided', async () => {
      const result = await controller.findByLanguagePair(null, {} as LanguagePairQueryDto);
      expect(result).toEqual([]);
      expect(discoveryService.findByLanguagePair).not.toHaveBeenCalled();
    });

    it('should delegate to discovery service with user id and query', async () => {
      const mockResults: Partial<UserProfile>[] = [{ id: 'lp1', display_name: 'Lang Partner' }];
      const query: Partial<LanguagePairQueryDto> = { native_language: 'EN', target_language: 'JA' };

      discoveryService.findByLanguagePair.mockResolvedValue(
        mockResults as UserProfile[],
      );

      const result = await controller.findByLanguagePair(mockUser, query as LanguagePairQueryDto);

      expect(discoveryService.findByLanguagePair).toHaveBeenCalledWith(
        'user-1',
        query,
      );
      expect(result).toEqual(mockResults);
    });

    it('should handle query with pagination params', async () => {
      const query: Partial<LanguagePairQueryDto> = {
        native_language: 'FR',
        page: 2,
        limit: 20,
        sort: 'newest',
      };

      discoveryService.findByLanguagePair.mockResolvedValue([]);

      await controller.findByLanguagePair(mockUser, query as LanguagePairQueryDto);

      expect(discoveryService.findByLanguagePair).toHaveBeenCalledWith(
        'user-1',
        query,
      );
    });

    it('should handle query with voice_room_active filter', async () => {
      const query: Partial<LanguagePairQueryDto> = {
        native_language: 'DE',
        voice_room_active: true,
      };

      discoveryService.findByLanguagePair.mockResolvedValue([]);

      await controller.findByLanguagePair(mockUser, query as LanguagePairQueryDto);

      expect(discoveryService.findByLanguagePair).toHaveBeenCalledWith(
        'user-1',
        query,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // searchByLocation
  // ---------------------------------------------------------------------------
  describe('searchByLocation', () => {
    it('should return empty array if user is not provided', async () => {
      const result = await controller.searchByLocation(null);
      expect(result).toEqual([]);
      expect(discoveryService.searchByCountryCity).not.toHaveBeenCalled();
    });

    it('should search by country only', async () => {
      const mockResults: Partial<UserProfile>[] = [{ id: 'p1', country: 'Japan' }];

      discoveryService.searchByCountryCity.mockResolvedValue(
        mockResults as UserProfile[],
      );

      const result = await controller.searchByLocation(mockUser, 'Japan');

      expect(discoveryService.searchByCountryCity).toHaveBeenCalledWith(
        'user-1',
        { country: 'Japan', city: undefined },
      );
      expect(result).toEqual(mockResults);
    });

    it('should search by city only', async () => {
      const mockResults: Partial<UserProfile>[] = [{ id: 'p1', city: 'Tokyo' }];

      discoveryService.searchByCountryCity.mockResolvedValue(
        mockResults as UserProfile[],
      );

      const result = await controller.searchByLocation(
        mockUser,
        undefined,
        'Tokyo',
      );

      expect(discoveryService.searchByCountryCity).toHaveBeenCalledWith(
        'user-1',
        { country: undefined, city: 'Tokyo' },
      );
      expect(result).toEqual(mockResults);
    });

    it('should search by both country and city', async () => {
      const mockResults: Partial<UserProfile>[] = [
        { id: 'p1', country: 'Japan', city: 'Tokyo' },
      ];

      discoveryService.searchByCountryCity.mockResolvedValue(
        mockResults as UserProfile[],
      );

      const result = await controller.searchByLocation(
        mockUser,
        'Japan',
        'Tokyo',
      );

      expect(discoveryService.searchByCountryCity).toHaveBeenCalledWith(
        'user-1',
        { country: 'Japan', city: 'Tokyo' },
      );
      expect(result).toEqual(mockResults);
    });

    it('should delegate with undefined params when nothing provided', async () => {
      discoveryService.searchByCountryCity.mockResolvedValue([]);

      await controller.searchByLocation(mockUser);

      expect(discoveryService.searchByCountryCity).toHaveBeenCalledWith(
        'user-1',
        { country: undefined, city: undefined },
      );
    });
  });
});

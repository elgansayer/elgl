import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { UsersService } from '../users/users.service';
import { MetricsService } from '../metrics/metrics.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('DiscoveryController', () => {
  let controller: DiscoveryController;
  let discoveryService: DiscoveryService;
  let usersService: UsersService;

  const mockUser = { id: 'user-1', email: 'test@test.com' } as any;
  const mockProfile: any = { id: 'user-1', display_name: 'Test' };

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
        {
          provide: MetricsService,
          useValue: {
            recordDiscoverySearch: jest.fn(),
            recordDiscoveryAudioIntroRequest: jest.fn(),
            recordDiscoveryRecentNativeSpeakerRequest: jest.fn(),
            recordDiscoverySpotlightRequest: jest.fn(),
            recordDiscoveryLanguagePairRequest: jest.fn(),
            recordDiscoveryLocationSearchRequest: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<DiscoveryController>(DiscoveryController);
    discoveryService = module.get<DiscoveryService>(DiscoveryService);
    usersService = module.get<UsersService>(UsersService);
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
      const result = await controller.findPartners(null, {} as any);
      expect(result).toEqual([]);
      expect(usersService.getProfile).not.toHaveBeenCalled();
      expect(discoveryService.searchPartners).not.toHaveBeenCalled();
    });

    it('should get user profile and search partners when user is provided', async () => {
      const mockPartners: any[] = [{ id: 'partner-1' }];
      const query: any = { native_languages: 'JA' };

      (usersService.getProfile as jest.Mock).mockResolvedValue(mockProfile);
      (discoveryService.searchPartners as jest.Mock).mockResolvedValue(
        mockPartners,
      );

      const result = await controller.findPartners(mockUser, query);

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
      const query: any = {};
      const mockPartners: any[] = [{ id: 'p1' }];

      (usersService.getProfile as jest.Mock).mockResolvedValue(seriousProfile);
      (discoveryService.searchPartners as jest.Mock).mockResolvedValue(
        mockPartners,
      );

      await controller.findPartners(mockUser, query);

      expect(query.serious_learner_mode).toBe(true);
    });

    it('should NOT set serious_learner_mode when profile is not a serious learner', async () => {
      const normalProfile = {
        ...mockProfile,
        is_serious_learner: false,
      };
      const query: any = {};

      (usersService.getProfile as jest.Mock).mockResolvedValue(normalProfile);
      (discoveryService.searchPartners as jest.Mock).mockResolvedValue([]);

      await controller.findPartners(mockUser, query);

      expect(query.serious_learner_mode).toBeUndefined();
    });

    it('should NOT set serious_learner_mode when profile is null', async () => {
      const query: any = {};

      (usersService.getProfile as jest.Mock).mockResolvedValue(null);
      (discoveryService.searchPartners as jest.Mock).mockResolvedValue([]);

      await controller.findPartners(mockUser, query);

      expect(query.serious_learner_mode).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // getPartnerOfWeek
  // ---------------------------------------------------------------------------
  describe('getPartnerOfWeek', () => {
    it('should return partner of week IDs from the service', async () => {
      const mockIds = ['id-a', 'id-b'];
      (discoveryService.getPartnerOfWeekIds as jest.Mock).mockResolvedValue(
        mockIds,
      );

      const result = await controller.getPartnerOfWeek();

      expect(result).toEqual(mockIds);
      expect(discoveryService.getPartnerOfWeekIds).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no partners of week', async () => {
      (discoveryService.getPartnerOfWeekIds as jest.Mock).mockResolvedValue([]);

      const result = await controller.getPartnerOfWeek();

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getAudioIntros
  // ---------------------------------------------------------------------------
  describe('getAudioIntros', () => {
    it('should return empty array if user is not provided', async () => {
      const result = await controller.getAudioIntros(null, {} as any);
      expect(result).toEqual([]);
      expect(discoveryService.getAudioIntros).not.toHaveBeenCalled();
    });

    it('should delegate to discovery service with user profile and query', async () => {
      const mockResults: any[] = [{ id: 'p1', audio_intro_url: 'https://...' }];
      const query: any = { native_languages: 'ES' };

      (usersService.getProfile as jest.Mock).mockResolvedValue(mockProfile);
      (discoveryService.getAudioIntros as jest.Mock).mockResolvedValue(
        mockResults,
      );

      const result = await controller.getAudioIntros(mockUser, query);

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
      const mockResults: any[] = [
        { id: 'p1', native_languages: ['ja'] },
        { id: 'p2', native_languages: ['ko'] },
      ];

      (discoveryService.getRecentNativeSpeakers as jest.Mock).mockResolvedValue(
        mockResults,
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
      const mockResults: any[] = [
        { id: 'p1', is_vip: true },
        { id: 'p2', is_vip: false },
      ];

      (discoveryService.getSpotlightUsers as jest.Mock).mockResolvedValue(
        mockResults,
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
      const result = await controller.findByLanguagePair(null, {} as any);
      expect(result).toEqual([]);
      expect(discoveryService.findByLanguagePair).not.toHaveBeenCalled();
    });

    it('should delegate to discovery service with user id and query', async () => {
      const mockResults: any[] = [{ id: 'lp1', display_name: 'Lang Partner' }];
      const query: any = { native_language: 'EN', target_language: 'JA' };

      (discoveryService.findByLanguagePair as jest.Mock).mockResolvedValue(
        mockResults,
      );

      const result = await controller.findByLanguagePair(mockUser, query);

      expect(discoveryService.findByLanguagePair).toHaveBeenCalledWith(
        'user-1',
        query,
      );
      expect(result).toEqual(mockResults);
    });

    it('should handle query with pagination params', async () => {
      const query: any = {
        native_language: 'FR',
        page: 2,
        limit: 20,
        sort: 'newest',
      };

      (discoveryService.findByLanguagePair as jest.Mock).mockResolvedValue([]);

      await controller.findByLanguagePair(mockUser, query);

      expect(discoveryService.findByLanguagePair).toHaveBeenCalledWith(
        'user-1',
        query,
      );
    });

    it('should handle query with voice_room_active filter', async () => {
      const query: any = {
        native_language: 'DE',
        voice_room_active: true,
      };

      (discoveryService.findByLanguagePair as jest.Mock).mockResolvedValue([]);

      await controller.findByLanguagePair(mockUser, query);

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
      const mockResults: any[] = [{ id: 'p1', country: 'Japan' }];

      (discoveryService.searchByCountryCity as jest.Mock).mockResolvedValue(
        mockResults,
      );

      const result = await controller.searchByLocation(mockUser, 'Japan');

      expect(discoveryService.searchByCountryCity).toHaveBeenCalledWith(
        'user-1',
        { country: 'Japan', city: undefined },
      );
      expect(result).toEqual(mockResults);
    });

    it('should search by city only', async () => {
      const mockResults: any[] = [{ id: 'p1', city: 'Tokyo' }];

      (discoveryService.searchByCountryCity as jest.Mock).mockResolvedValue(
        mockResults,
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
      const mockResults: any[] = [
        { id: 'p1', country: 'Japan', city: 'Tokyo' },
      ];

      (discoveryService.searchByCountryCity as jest.Mock).mockResolvedValue(
        mockResults,
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
      (discoveryService.searchByCountryCity as jest.Mock).mockResolvedValue([]);

      await controller.searchByLocation(mockUser);

      expect(discoveryService.searchByCountryCity).toHaveBeenCalledWith(
        'user-1',
        { country: undefined, city: undefined },
      );
    });
  });
});

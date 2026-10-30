import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { DiscoveryDegradationService } from './discovery-degradation.service';
import { DiscoveryRateLimiterGuard } from './discovery-rate-limiter.guard';
import { UsersService } from '../users/users.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { DISCOVERY_CACHE_NO_STORE } from './cache.interceptor';

vi.mock('./sanitise-discovery.helper', () => ({
  sanitiseDiscoveryData: (x: unknown) => x,
}));

describe('DiscoveryController', () => {
  let controller: DiscoveryController;
  let discoveryService: DiscoveryService;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DiscoveryController],
      providers: [
        {
          provide: DiscoveryService,
          useValue: {
            searchPartnersWithDegradation: vi.fn().mockResolvedValue({
              data: [],
              marker: { degraded: false, fallbackSource: 'none' as const },
            }),
            getAudioIntros: vi.fn().mockResolvedValue([]),
            getPartnerOfWeekIds: vi.fn().mockResolvedValue([]),
          },
        },
        {
          provide: DiscoveryDegradationService,
          useValue: {
            getAllBreakerStates: vi.fn().mockReturnValue(new Map()),
            getRecentDegradationEvents: vi.fn().mockResolvedValue([]),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getProfile: vi.fn(),
          },
        },
        {
          provide: DiscoveryRateLimiterGuard,
          useValue: { canActivate: vi.fn().mockReturnValue(true) },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .overrideGuard(DiscoveryRateLimiterGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<DiscoveryController>(DiscoveryController);
    discoveryService = module.get<DiscoveryService>(DiscoveryService);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('privacy-safe cache partitioning', () => {
    const cacheDirectiveFor = (
      method:
        | 'findPartners'
        | 'findPartnersWithDegradation'
        | 'getPartnerOfWeek'
        | 'getAudioIntros'
        | 'getRecentNativeSpeakers'
        | 'getSpotlight'
        | 'findByLanguagePair'
        | 'searchByLocation',
    ): Record<string, string> => {
      const interceptors = Reflect.getMetadata(
        INTERCEPTORS_METADATA,
        DiscoveryController.prototype[method],
      ) as Array<{ directive: Record<string, string> }>;
      return interceptors[0].directive;
    };

    it.each([
      'findPartners',
      'findPartnersWithDegradation',
      'getPartnerOfWeek',
      'getAudioIntros',
      'getRecentNativeSpeakers',
      'getSpotlight',
      'findByLanguagePair',
      'searchByLocation',
    ] as const)(
      'does not HTTP-cache privacy-sensitive %s responses',
      (method) => {
        expect(cacheDirectiveFor(method)).toEqual(DISCOVERY_CACHE_NO_STORE);
      },
    );
  });

  describe('findPartners', () => {
    it('documents the unavailable response exposed by degraded searches', () => {
      const responses = Reflect.getMetadata(
        'swagger/apiResponse',
        DiscoveryController.prototype.findPartners,
      ) as Record<string, { description: string }>;

      expect(responses['503']).toEqual({
        description: 'Partner discovery is temporarily unavailable.',
      });
    });

    it('should return empty array if user is not provided', async () => {
      const result = await controller.findPartners(null, {});
      expect(result).toEqual([]);
      expect(usersService.getProfile).not.toHaveBeenCalled();
      expect(
        discoveryService.searchPartnersWithDegradation,
      ).not.toHaveBeenCalled();
    });

    it('should get user profile and search partners when user is provided', async () => {
      const mockProfile: any = { id: 'user-1', display_name: 'Test' };
      const mockPartners: any[] = [{ id: 'partner-1' }];
      const query: any = { native_languages: ['JA'] };

      (usersService.getProfile as Mock).mockResolvedValue(mockProfile);
      (
        discoveryService.searchPartnersWithDegradation as Mock
      ).mockResolvedValue({
        data: mockPartners,
        marker: { degraded: false, fallbackSource: 'none' },
      });

      const result = await controller.findPartners(
        { id: 'user-1' } as any,
        query,
      );

      expect(usersService.getProfile).toHaveBeenCalledWith('user-1');
      expect(
        discoveryService.searchPartnersWithDegradation,
      ).toHaveBeenCalledWith('user-1', mockProfile, query);
      expect(result).toEqual(mockPartners);
    });

    it('should report a degraded partner search as unavailable', async () => {
      (usersService.getProfile as Mock).mockResolvedValue({ id: 'user-1' });
      (
        discoveryService.searchPartnersWithDegradation as Mock
      ).mockResolvedValue({
        data: [],
        marker: {
          degraded: true,
          reason: 'Service discovery_partners failed',
          fallbackSource: 'basic_query',
        },
      });

      await expect(
        controller.findPartners({ id: 'user-1' } as any, {}),
      ).rejects.toThrow('Partner discovery is temporarily unavailable');
    });

    it('should return valid partners from a partial degraded search', async () => {
      const fallbackPartners = [{ id: 'partner-1' }];
      (usersService.getProfile as Mock).mockResolvedValue({ id: 'user-1' });
      (
        discoveryService.searchPartnersWithDegradation as Mock
      ).mockResolvedValue({
        data: fallbackPartners,
        marker: {
          degraded: true,
          reason: 'Primary query timed out',
          fallbackSource: 'basic_query',
        },
      });

      await expect(
        controller.findPartners({ id: 'user-1' } as any, {}),
      ).resolves.toEqual(fallbackPartners);
    });

    it('should enable the algorithmic filter when serious learner mode is requested', async () => {
      const mockProfile: any = { id: 'user-1', is_serious_learner: false };
      const query: any = { serious_learner_mode: true };

      (usersService.getProfile as Mock).mockResolvedValue(mockProfile);

      await controller.findPartners({ id: 'user-1' } as any, query);

      expect(query.serious_learner_only).toBe(true);
      expect(
        discoveryService.searchPartnersWithDegradation,
      ).toHaveBeenCalledWith(
        'user-1',
        mockProfile,
        expect.objectContaining({
          serious_learner_mode: true,
          serious_learner_only: true,
        }),
      );
    });

    it('should enable the algorithmic filter for profiles enrolled in serious learner mode', async () => {
      const mockProfile: any = { id: 'user-1', serious_learner_mode: true };
      const query: any = {};

      (usersService.getProfile as Mock).mockResolvedValue(mockProfile);

      await controller.findPartners({ id: 'user-1' } as any, query);

      expect(query.serious_learner_mode).toBe(true);
      expect(query.serious_learner_only).toBe(true);
    });

    it('should not force the algorithmic filter for ordinary discovery', async () => {
      const mockProfile: any = { id: 'user-1', is_serious_learner: false };
      const query: any = {};

      (usersService.getProfile as Mock).mockResolvedValue(mockProfile);

      await controller.findPartners({ id: 'user-1' } as any, query);

      expect(query.serious_learner_mode).toBeUndefined();
      expect(query.serious_learner_only).toBeUndefined();
    });
  });

  describe('getPartnerOfWeek', () => {
    it('returns no IDs without an authenticated viewer', async () => {
      await expect(controller.getPartnerOfWeek(null)).resolves.toEqual([]);
      expect(discoveryService.getPartnerOfWeekIds).not.toHaveBeenCalled();
    });

    it('passes the authenticated viewer to privacy revalidation', async () => {
      (discoveryService.getPartnerOfWeekIds as Mock).mockResolvedValue([
        'partner-1',
      ]);

      await expect(
        controller.getPartnerOfWeek({ id: 'viewer-1' } as any),
      ).resolves.toEqual(['partner-1']);
      expect(discoveryService.getPartnerOfWeekIds).toHaveBeenCalledWith(
        'viewer-1',
      );
    });
  });

  describe('getAudioIntros', () => {
    it('should apply the same serious learner filter to audio-intro discovery', async () => {
      const mockProfile: any = { id: 'user-1', serious_learner_mode: true };
      const query: any = {};

      (usersService.getProfile as Mock).mockResolvedValue(mockProfile);

      await controller.getAudioIntros({ id: 'user-1' } as any, query);

      expect(query.serious_learner_mode).toBe(true);
      expect(query.serious_learner_only).toBe(true);
      expect(discoveryService.getAudioIntros).toHaveBeenCalledWith(
        'user-1',
        mockProfile,
        expect.objectContaining({
          serious_learner_mode: true,
          serious_learner_only: true,
        }),
      );
    });
  });

  describe('findPartnersWithDegradation', () => {
    it('should normalize serious learner mode before degradation-aware search', async () => {
      const mockProfile: any = { id: 'user-1', is_serious_learner: false };
      const query: any = { serious_learner_mode: true };

      (usersService.getProfile as Mock).mockResolvedValue(mockProfile);

      await controller.findPartnersWithDegradation(
        { id: 'user-1' } as any,
        query,
      );

      expect(query.serious_learner_only).toBe(true);
      expect(
        discoveryService.searchPartnersWithDegradation,
      ).toHaveBeenCalledWith(
        'user-1',
        mockProfile,
        expect.objectContaining({ serious_learner_only: true }),
      );
    });
  });

  describe('PostGIS matching algorithm with customisable radius', () => {
    it('should find partners within custom radius when coordinates and radius_metres are specified', async () => {
      const mockProfile: any = { id: 'user-1', display_name: 'Searcher' };
      const nearbyPartner: any = {
        id: 'partner-nearby',
        display_name: 'Nearby Partner',
        distance_metres: 1250,
        native_languages: ['ja'],
        target_languages: ['en'],
      };
      const query: any = {
        latitude: 51.5074,
        longitude: -0.1278,
        radius_metres: 15000,
      };

      (usersService.getProfile as Mock).mockResolvedValue(mockProfile);
      (
        discoveryService.searchPartnersWithDegradation as Mock
      ).mockResolvedValue({
        data: [nearbyPartner],
        marker: { degraded: false, fallbackSource: 'none' },
      });

      const result = await controller.findPartners(
        { id: 'user-1' } as any,
        query,
      );

      expect(usersService.getProfile).toHaveBeenCalledWith('user-1');
      expect(
        discoveryService.searchPartnersWithDegradation,
      ).toHaveBeenCalledWith('user-1', mockProfile, query);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'partner-nearby',
          distance_metres: 1250,
        }),
      );
    });

    it('should forward search coordinates when radius_metres is omitted', async () => {
      const mockProfile: any = { id: 'user-1', display_name: 'Searcher' };
      const query: any = {
        latitude: 51.5074,
        longitude: -0.1278,
      };

      (usersService.getProfile as Mock).mockResolvedValue(mockProfile);
      (
        discoveryService.searchPartnersWithDegradation as Mock
      ).mockResolvedValue({
        data: [],
        marker: { degraded: false, fallbackSource: 'none' },
      });

      const result = await controller.findPartners(
        { id: 'user-1' } as any,
        query,
      );

      expect(result).toEqual([]);
      expect(
        discoveryService.searchPartnersWithDegradation,
      ).toHaveBeenCalledWith(
        'user-1',
        mockProfile,
        expect.objectContaining({
          latitude: 51.5074,
          longitude: -0.1278,
        }),
      );
    });

    it('should forward "nearest" sort order alongside custom radius proximity queries', async () => {
      const mockProfile: any = { id: 'user-1' };
      const query: any = {
        latitude: 51.5074,
        longitude: -0.1278,
        radius_metres: 25000,
        sort: 'nearest',
      };

      (usersService.getProfile as Mock).mockResolvedValue(mockProfile);
      (
        discoveryService.searchPartnersWithDegradation as Mock
      ).mockResolvedValue({
        data: [
          { id: 'partner-closer', distance_metres: 500 },
          { id: 'partner-further', distance_metres: 12000 },
        ],
        marker: { degraded: false, fallbackSource: 'none' },
      });

      const result = await controller.findPartners(
        { id: 'user-1' } as any,
        query,
      );

      expect(result).toHaveLength(2);
      expect(result[0].distance_metres).toBe(500);
      expect(result[1].distance_metres).toBe(12000);
      expect(
        discoveryService.searchPartnersWithDegradation,
      ).toHaveBeenCalledWith(
        'user-1',
        mockProfile,
        expect.objectContaining({
          sort: 'nearest',
          radius_metres: 25000,
        }),
      );
    });

    it('should pass VIP user profile with mock_location to enable VIP proximity matching', async () => {
      const vipProfile: any = {
        id: 'vip-user',
        is_vip: true,
        mock_location: {
          type: 'Point',
          coordinates: [139.6917, 35.6895],
        },
      };
      const query: any = {
        radius_metres: 10000,
      };

      (usersService.getProfile as Mock).mockResolvedValue(vipProfile);
      (
        discoveryService.searchPartnersWithDegradation as Mock
      ).mockResolvedValue({
        data: [{ id: 'tokyo-partner', distance_metres: 800 }],
        marker: { degraded: false, fallbackSource: 'none' },
      });

      const result = await controller.findPartners(
        { id: 'vip-user' } as any,
        query,
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('tokyo-partner');
      expect(
        discoveryService.searchPartnersWithDegradation,
      ).toHaveBeenCalledWith('vip-user', vipProfile, query);
    });

    it('should return empty list when no partners are within the specified radius', async () => {
      const mockProfile: any = { id: 'user-1' };
      const query: any = {
        latitude: 0,
        longitude: 0,
        radius_metres: 5000,
      };

      (usersService.getProfile as Mock).mockResolvedValue(mockProfile);
      (
        discoveryService.searchPartnersWithDegradation as Mock
      ).mockResolvedValue({
        data: [],
        marker: { degraded: false, fallbackSource: 'none' },
      });

      const result = await controller.findPartners(
        { id: 'user-1' } as any,
        query,
      );

      expect(result).toEqual([]);
    });

    it('should return spatial results with degradation marker in findPartnersWithDegradation', async () => {
      const mockProfile: any = { id: 'user-1' };
      const query: any = {
        latitude: 51.5074,
        longitude: -0.1278,
        radius_metres: 30000,
      };
      const expectedResult = {
        data: [{ id: 'partner-1', distance_metres: 2200 }],
        marker: { degraded: false, fallbackSource: 'none' as const },
      };

      (usersService.getProfile as Mock).mockResolvedValue(mockProfile);
      (
        discoveryService.searchPartnersWithDegradation as Mock
      ).mockResolvedValue(expectedResult);

      const result = await controller.findPartnersWithDegradation(
        { id: 'user-1' } as any,
        query,
      );

      expect(result).toEqual(expectedResult);
      expect(
        discoveryService.searchPartnersWithDegradation,
      ).toHaveBeenCalledWith('user-1', mockProfile, query);
    });

    it('should return empty array and not invoke service when user is null in proximity search', async () => {
      const result = await controller.findPartners(null, {
        latitude: 51.5074,
        longitude: -0.1278,
        radius_metres: 15000,
      });

      expect(result).toEqual([]);
      expect(usersService.getProfile).not.toHaveBeenCalled();
      expect(
        discoveryService.searchPartnersWithDegradation,
      ).not.toHaveBeenCalled();
    });

    it('should return empty degraded result when user is null in findPartnersWithDegradation', async () => {
      const result = await controller.findPartnersWithDegradation(null, {
        latitude: 51.5074,
        longitude: -0.1278,
        radius_metres: 15000,
      });

      expect(result).toEqual({
        data: [],
        marker: { degraded: false, fallbackSource: 'none' },
      });
      expect(usersService.getProfile).not.toHaveBeenCalled();
      expect(
        discoveryService.searchPartnersWithDegradation,
      ).not.toHaveBeenCalled();
    });
  });
});

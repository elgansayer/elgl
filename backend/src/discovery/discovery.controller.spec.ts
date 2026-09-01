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
      const mockProfile: any = { id: 'user-1', is_serious_learner: true };
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

  describe('getAudioIntros', () => {
    it('should apply the same serious learner filter to audio-intro discovery', async () => {
      const mockProfile: any = { id: 'user-1', is_serious_learner: true };
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
});

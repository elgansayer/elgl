import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { DiscoveryDegradationService } from './discovery-degradation.service';
import { DiscoveryRateLimiterGuard } from './discovery-rate-limiter.guard';
import { UsersService } from '../users/users.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { DiscoveryRateLimiterGuard } from './discovery-rate-limiter.guard';

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
  });
});

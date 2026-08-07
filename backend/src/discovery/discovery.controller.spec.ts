import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { DiscoveryDegradationService } from './discovery-degradation.service';
import { UsersService } from '../users/users.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

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
            searchPartnersWithDegradation: jest.fn().mockResolvedValue({
              data: [],
              marker: { degraded: false, fallbackSource: 'none' as const },
            }),
          },
        },
        {
          provide: DiscoveryDegradationService,
          useValue: {
            getAllBreakerStates: jest.fn().mockReturnValue(new Map()),
            getRecentDegradationEvents: jest.fn().mockResolvedValue([]),
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

      (usersService.getProfile as jest.Mock).mockResolvedValue(mockProfile);
      (
        discoveryService.searchPartnersWithDegradation as jest.Mock
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

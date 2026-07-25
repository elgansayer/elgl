import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
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
            searchPartners: jest.fn(),
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
      expect(discoveryService.searchPartners).not.toHaveBeenCalled();
    });

    it('should get user profile and search partners when user is provided', async () => {
      const mockProfile: any = { id: 'user-1', display_name: 'Test' };
      const mockPartners: any[] = [{ id: 'partner-1' }];
      const query: any = { native_languages: ['JA'] };

      (usersService.getProfile as jest.Mock).mockResolvedValue(mockProfile);
      (discoveryService.searchPartners as jest.Mock).mockResolvedValue(
        mockPartners,
      );

      const result = await controller.findPartners(
        { id: 'user-1' } as any,
        query,
      );

      expect(usersService.getProfile).toHaveBeenCalledWith('user-1');
      expect(discoveryService.searchPartners).toHaveBeenCalledWith(
        'user-1',
        mockProfile,
        query,
      );
      expect(result).toEqual(mockPartners);
    });
  });
});

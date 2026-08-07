import { Test, TestingModule } from '@nestjs/testing';
import { EconomyController } from './economy.controller';
import { EconomyService } from './economy.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('EconomyController', () => {
  let controller: EconomyController;
  let economyService: EconomyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EconomyController],
      providers: [
        {
          provide: EconomyService,
          useValue: {
            getCatalog: jest.fn(),
            getPackages: jest.fn(),
            getBalance: jest.fn(),
            claimDailyCheckIn: jest.fn(),
            createCheckoutSession: jest.fn(),
            purchaseCoins: jest.fn(),
            sendGift: jest.fn(),
            unlockStickerPack: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<EconomyController>(EconomyController);
    economyService = module.get<EconomyService>(EconomyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCatalog', () => {
    it('should return catalog from service', async () => {
      const catalog: any[] = [{ id: 'gift-1' }];
      (economyService.getCatalog as jest.Mock).mockResolvedValue(catalog);

      const result = await controller.getCatalog();
      expect(economyService.getCatalog).toHaveBeenCalled();
      expect(result).toEqual(catalog);
    });
  });

  describe('getPackages', () => {
    it('should return packages from service', () => {
      const packages: any[] = [{ id: 'pkg-1' }];
      (economyService.getPackages as jest.Mock).mockReturnValue(packages);

      const result = controller.getPackages();
      expect(economyService.getPackages).toHaveBeenCalled();
      expect(result).toEqual(packages);
    });
  });

  describe('getBalance', () => {
    it('should return 0 balance if user is not provided', async () => {
      const result = await controller.getBalance(null);
      expect(result).toEqual({ coins_balance: 0 });
      expect(economyService.getBalance).not.toHaveBeenCalled();
    });

    it('should call service getBalance when user is provided', async () => {
      const balance = { coins_balance: 150 };
      (economyService.getBalance as jest.Mock).mockResolvedValue(balance);

      const result = await controller.getBalance({ id: 'user-1' } as any);
      expect(economyService.getBalance).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(balance);
    });
  });

  describe('claimDailyCheckIn', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.claimDailyCheckIn(null);
      expect(result).toBeNull();
      expect(economyService.claimDailyCheckIn).not.toHaveBeenCalled();
    });

    it('should call service claimDailyCheckIn when user is provided', async () => {
      const response = { claimed: true, coins_rewarded: 7, new_balance: 157 };
      (economyService.claimDailyCheckIn as jest.Mock).mockResolvedValue(response);

      const result = await controller.claimDailyCheckIn({ id: 'user-1' } as any);
      expect(economyService.claimDailyCheckIn).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(response);
    });

    it('should handle already claimed scenario', async () => {
      const response = { claimed: false, coins_rewarded: 0, new_balance: 100 };
      (economyService.claimDailyCheckIn as jest.Mock).mockResolvedValue(response);

      const result = await controller.claimDailyCheckIn({ id: 'user-1' } as any);
      expect(economyService.claimDailyCheckIn).toHaveBeenCalledWith('user-1');
      expect(result.claimed).toBe(false);
      expect(result.coins_rewarded).toBe(0);
    });
  });

  describe('createCheckoutSession', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.createCheckoutSession(null, { package_id: 'pkg-1' });
      expect(result).toBeNull();
    });

    it('should call service createCheckoutSession when user is provided', async () => {
      const dto: any = { package_id: 'pkg-1' };
      const response: any = { sessionUrl: 'https://checkout.stripe.com/...' };
      (economyService.createCheckoutSession as jest.Mock).mockResolvedValue(response);

      const result = await controller.createCheckoutSession({ id: 'user-1' } as any, dto);
      expect(economyService.createCheckoutSession).toHaveBeenCalledWith('user-1', 'pkg-1');
      expect(result).toEqual(response);
    });
  });

  describe('purchaseCoins', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.purchaseCoins(null, {} as any);
      expect(result).toBeNull();
      expect(economyService.purchaseCoins).not.toHaveBeenCalled();
    });

    it('should call service purchaseCoins when user is provided', async () => {
      const dto: any = { amount: 100, package_id: 'pkg-1' };
      const response: any = { coins_balance: 200, package_id: 'pkg-1' };
      (economyService.purchaseCoins as jest.Mock).mockResolvedValue(response);

      const result = await controller.purchaseCoins(
        { id: 'user-1' } as any,
        dto,
      );
      expect(economyService.purchaseCoins).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(response);
    });
  });

  describe('sendGift', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.sendGift(null, {} as any);
      expect(result).toBeNull();
      expect(economyService.sendGift).not.toHaveBeenCalled();
    });

    it('should call service sendGift when user is provided', async () => {
      const dto: any = { gift_id: 'gift-1', receiver_id: 'user-2' };
      const response: any = { success: true, coins_remaining: 50 };
      (economyService.sendGift as jest.Mock).mockResolvedValue(response);

      const result = await controller.sendGift({ id: 'user-1' } as any, dto);
      expect(economyService.sendGift).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(response);
    });
  });

  describe('unlockStickerPack', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.unlockStickerPack(null, { pack_id: 'pack-1' } as any);
      expect(result).toBeNull();
    });

    it('should call service unlockStickerPack when user is provided', async () => {
      const dto: any = { pack_id: 'pack-1' };
      const response: any = { unlocked: true, coins_remaining: 80 };
      (economyService.unlockStickerPack as jest.Mock).mockResolvedValue(response);

      const result = await controller.unlockStickerPack({ id: 'user-1' } as any, dto);
      expect(economyService.unlockStickerPack).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(response);
    });
  });
});

jest.mock('jsdom', () => ({
  JSDOM: jest.fn().mockImplementation(() => ({
    window: {
      document: {
        createElement: jest.fn(),
        createDocumentFragment: jest.fn(),
      },
      Node: { ELEMENT_NODE: 1, TEXT_NODE: 3, DOCUMENT_FRAGMENT_NODE: 11 },
      NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 },
    },
  })),
}));

jest.mock('dompurify', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    sanitize: (dirty: string): string => {
      if (typeof dirty !== 'string') return dirty;
      return dirty.replace(/<[^>]*>/g, '');
    },
    setConfig: jest.fn(),
  })),
}));

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
            getBalance: jest.fn(),
            purchaseCoins: jest.fn(),
            sendGift: jest.fn(),
            getStickerPacks: jest.fn(),
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

<<<<<<< HEAD
  describe('claimDailyCheckIn', () => {
    it('should return a default object if user is not provided', async () => {
      const result = await controller.claimDailyCheckIn(null);
      expect(result).toEqual({
        claimed: false,
        coins_rewarded: 0,
        new_balance: 0,
      });
      expect(economyService.claimDailyCheckIn).not.toHaveBeenCalled();
    });

    it('should call service claimDailyCheckIn when user is provided', async () => {
      const response: any = {
        claimed: true,
        coins_rewarded: 5,
        new_balance: 155,
      };
      (economyService.claimDailyCheckIn as jest.Mock).mockResolvedValue(
        response,
      );

      const result = await controller.claimDailyCheckIn({
        id: 'user-1',
      } as any);
      expect(economyService.claimDailyCheckIn).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(response);
    });
  });

  describe('createCheckoutSession', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.createCheckoutSession(null, {
        package_id: 'pkg-1',
      });
      expect(result).toBeNull();
      expect(economyService.createCheckoutSession).not.toHaveBeenCalled();
    });

    it('should call service createCheckoutSession when user is provided', async () => {
      const response: any = {
        sessionUrl: 'https://checkout.stripe.com/...',
        sessionId: 'cs_...',
      };
      (economyService.createCheckoutSession as jest.Mock).mockResolvedValue(
        response,
      );

      const result = await controller.createCheckoutSession(
        { id: 'user-1' } as any,
        { package_id: 'coins_small' },
      );
      expect(economyService.createCheckoutSession).toHaveBeenCalledWith(
        'user-1',
        'coins_small',
      );
      expect(result).toEqual(response);
    });
  });

=======
>>>>>>> origin/main
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

  describe('getStickerPacks', () => {
    it('should return sticker packs from service', async () => {
      const response = { packs: [], owned_pack_ids: [], user_coins: 100 };
      (economyService.getStickerPacks as jest.Mock).mockResolvedValue(response);

      const result = await controller.getStickerPacks({ id: 'user-1' } as any);
      expect(economyService.getStickerPacks).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(response);
    });
  });

  describe('unlockStickerPack', () => {
    it('should call service unlockStickerPack when user is provided', async () => {
      const dto = { pack_id: 'stk_pack_1' };
      const response = {
        success: true,
        coins_remaining: 150,
        pack: { id: 'stk_pack_1', name: 'Happy Corgi Pack', cost_coins: 50 },
      };
      (economyService.unlockStickerPack as jest.Mock).mockResolvedValue(
        response,
      );

      const result = await controller.unlockStickerPack(
        { id: 'user-1' } as any,
        dto,
      );
      expect(economyService.unlockStickerPack).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(response);
    });
  });
});

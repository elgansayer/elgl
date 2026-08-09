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
import { Logger } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { EconomyController } from './economy.controller';
import { EconomyService } from './economy.service';
import { CoinEconomyHealthService } from './coin-economy-health.service';
import { EconomyExceptionFilter } from './economy-exception.filter';
import { EconomyRateLimiterGuard } from './economy-rate-limiter.guard';
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
            getStickerPacks: jest.fn(),
            unlockStickerPack: jest.fn(),
            getTransactionHistory: jest.fn(),
          },
        },
        {
          provide: CoinEconomyHealthService,
          useValue: {
            getHealthSnapshot: jest.fn().mockResolvedValue({
              overall: 'healthy',
              timestamp: new Date().toISOString(),
              dependencies: {},
              circuitBreakers: {},
              degradedFeatures: [],
              uptimeSeconds: 3600,
            }),
            getDegradedFeatures: jest.fn().mockReturnValue([]),
            markFeatureDegraded: jest.fn(),
            clearFeatureDegradation: jest.fn(),
            isFeatureDegraded: jest.fn().mockReturnValue(false),
          },
        },
        {
          provide: EconomyExceptionFilter,
          useValue: { catch: jest.fn() },
        },
        {
          provide: 'PinoLogger:EconomyExceptionFilter',
          useValue: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(EconomyRateLimiterGuard)
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
    it('should return coin packages from service', () => {
      const packages = [{ id: 'coins_small', coins: 100 }];
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

    it('should degrade gracefully to default 50 coins when service throws', async () => {
      (economyService.getBalance as jest.Mock).mockRejectedValue(
        new Error('DB down'),
      );

      const result = await controller.getBalance({ id: 'user-1' } as any);
      expect(result).toEqual({ coins_balance: 50 });
    });
  });

  describe('claimDailyCheckIn', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.claimDailyCheckIn(null);
      expect(result).toBeNull();
      expect(economyService.claimDailyCheckIn).not.toHaveBeenCalled();
    });

    it('should call service claimDailyCheckIn when user is provided', async () => {
      const response = { claimed: true, coins_rewarded: 7, new_balance: 107 };
      (economyService.claimDailyCheckIn as jest.Mock).mockResolvedValue(
        response,
      );

      const result = await controller.claimDailyCheckIn({
        id: 'user-1',
      } as any);
      expect(economyService.claimDailyCheckIn).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(response);
    });

    it('should degrade gracefully when service throws', async () => {
      (economyService.claimDailyCheckIn as jest.Mock).mockRejectedValue(
        new Error('DB down'),
      );

      const result = await controller.claimDailyCheckIn({
        id: 'user-1',
      } as any);
      expect(result).toEqual({
        claimed: false,
        coins_rewarded: 0,
        new_balance: 50,
      });
    });
  });

  describe('createCheckoutSession', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.createCheckoutSession(null, {
        package_id: 'coins_small',
      });
      expect(result).toBeNull();
      expect(economyService.createCheckoutSession).not.toHaveBeenCalled();
    });

    it('should call service createCheckoutSession when user is provided', async () => {
      const response = {
        sessionUrl: 'https://checkout.stripe.com/test',
        sessionId: 'sess_123',
      };
      (economyService.createCheckoutSession as jest.Mock).mockResolvedValue(
        response,
      );

      const result = await controller.createCheckoutSession(
        { id: 'user-1' } as any,
        { package_id: 'coins_medium' },
      );
      expect(economyService.createCheckoutSession).toHaveBeenCalledWith(
        'user-1',
        'coins_medium',
      );
      expect(result).toEqual(response);
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

  describe('getTransactions', () => {
    it('should return empty transactions array when user is null', async () => {
      const result = await controller.getTransactions(null);
      expect(result).toEqual({ transactions: [] });
    });

    it('should return transactions from service when user is provided', async () => {
      const mockTransactions = [
        {
          id: 'tx-1',
          user_id: 'user-1',
          type: 'daily_checkin',
          amount: 7,
          description: 'Daily check-in reward',
          metadata: null,
          created_at: '2026-08-08T12:00:00.000Z',
        },
      ];
      (economyService.getTransactionHistory as jest.Mock).mockResolvedValue(
        mockTransactions,
      );

      const result = await controller.getTransactions({ id: 'user-1' } as any);
      expect(economyService.getTransactionHistory).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual({ transactions: mockTransactions });
    });

    it('should return empty transactions on service error', async () => {
      (economyService.getTransactionHistory as jest.Mock).mockRejectedValue(
        new Error('DB down'),
      );

      const result = await controller.getTransactions({ id: 'user-1' } as any);
      expect(result).toEqual({ transactions: [] });
    });
  });

  describe('rate limiting decorators', () => {
    const proto = EconomyController.prototype;
    const THROTTLER_LIMIT = 'THROTTLER:LIMIT';
    const THROTTLER_TTL = 'THROTTLER:TTL';

    it('should apply Throttle decorator to getCatalog', () => {
      expect(
        Reflect.getMetadata(THROTTLER_LIMIT + 'default', proto.getCatalog),
      ).toBe(30);
      expect(
        Reflect.getMetadata(THROTTLER_TTL + 'default', proto.getCatalog),
      ).toBe(60000);
    });

    it('should apply Throttle decorator to getBalance', () => {
      expect(
        Reflect.getMetadata(THROTTLER_LIMIT + 'default', proto.getBalance),
      ).toBe(30);
    });

    it('should apply Throttle decorator to claimDailyCheckIn', () => {
      expect(
        Reflect.getMetadata(
          THROTTLER_LIMIT + 'default',
          proto.claimDailyCheckIn,
        ),
      ).toBe(3);
    });

    it('should apply Throttle decorator to purchaseCoins', () => {
      expect(
        Reflect.getMetadata(THROTTLER_LIMIT + 'default', proto.purchaseCoins),
      ).toBe(5);
    });

    it('should apply Throttle decorator to sendGift', () => {
      expect(
        Reflect.getMetadata(THROTTLER_LIMIT + 'default', proto.sendGift),
      ).toBe(10);
    });

    it('should apply EconomyRateLimit decorator to getBalance', () => {
      const metadata = Reflect.getMetadata(
        'economy-rate-limit',
        proto.getBalance,
      );
      expect(metadata).toEqual({ maxRequests: 20, windowSeconds: 60 });
    });

    it('should apply EconomyRateLimit decorator to createCheckoutSession', () => {
      const metadata = Reflect.getMetadata(
        'economy-rate-limit',
        proto.createCheckoutSession,
      );
      expect(metadata).toEqual({ maxRequests: 5, windowSeconds: 60 });
    });

    it('should apply EconomyRateLimit decorator to sendGift', () => {
      const metadata = Reflect.getMetadata(
        'economy-rate-limit',
        proto.sendGift,
      );
      expect(metadata).toEqual({ maxRequests: 10, windowSeconds: 60 });
    });
  });

  describe('getHealth', () => {
    it('should return health snapshot from health service', async () => {
      const mockSnapshot = {
        overall: 'healthy' as const,
        timestamp: '2026-08-07T12:00:00.000Z',
        dependencies: {
          redis: {
            status: 'healthy' as const,
            latencyMs: 1,
            lastChecked: '2026-08-07T12:00:00.000Z',
          },
          supabase: {
            status: 'healthy' as const,
            latencyMs: 2,
            lastChecked: '2026-08-07T12:00:00.000Z',
          },
          stripe: {
            status: 'healthy' as const,
            latencyMs: 50,
            lastChecked: '2026-08-07T12:00:00.000Z',
          },
          centrifugo: {
            status: 'healthy' as const,
            latencyMs: 3,
            lastChecked: '2026-08-07T12:00:00.000Z',
          },
        },
        circuitBreakers: {},
        degradedFeatures: [] as string[],
        uptimeSeconds: 3600,
      };

      const healthService = (
        controller as unknown as { healthService: CoinEconomyHealthService }
      ).healthService;
      (healthService.getHealthSnapshot as jest.Mock).mockResolvedValue(
        mockSnapshot,
      );

      const result = await controller.getHealth();
      expect(result).toEqual(mockSnapshot);
      expect(healthService.getHealthSnapshot).toHaveBeenCalled();
    });
  });
});

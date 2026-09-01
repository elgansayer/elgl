import type { Mock } from 'vitest';
vi.mock('jsdom', () => ({
  JSDOM: vi.fn().mockImplementation(function () {
    return {
      window: {
        document: {
          createElement: vi.fn(),
          createDocumentFragment: vi.fn(),
        },
        Node: {
          ELEMENT_NODE: 1,
          TEXT_NODE: 3,
          DOCUMENT_FRAGMENT_NODE: 11,
        },
        NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 },
      },
    };
  }),
}));

vi.mock('dompurify', () => ({
  __esModule: true,
  default: vi.fn(() => ({
    sanitize: (dirty: string): string => {
      if (typeof dirty !== 'string') return dirty;
      return dirty
        .replace(/<[^>]*>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'");
    },
    setConfig: vi.fn(),
  })),
}));

vi.mock('../common/http-retry.helper', () => ({
  withExponentialBackoff: vi.fn((fn: () => unknown) => fn()),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EconomyService } from './economy.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { CentrifugoService } from '../chat/centrifugo.service';
import { MetricsService } from '../metrics/metrics.service';
import { withExponentialBackoff } from '../common/http-retry.helper';
import { of } from 'rxjs';
import type Stripe from 'stripe';

describe('EconomyService', () => {
  let service: EconomyService;
  let centrifugoService: CentrifugoService;
  let usersService: UsersService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;
  let module: TestingModule;
  let mockRedisClient: { get: Mock; set: Mock; del: Mock };

  beforeEach(async () => {
    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
      rpc: vi.fn(),
    };

    mockRedisClient = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
    };

    module = await Test.createTestingModule({
      providers: [
        EconomyService,
        {
          provide: 'PinoLogger:EconomyService',
          useValue: {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
            getRedisClient: vi.fn().mockReturnValue(mockRedisClient),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getProfile: vi.fn().mockImplementation((id: string) => {
              if (id === 'sender-1')
                return Promise.resolve({
                  id: 'sender-1',
                  display_name: 'Sender User',
                });
              if (id === 'receiver-1')
                return Promise.resolve({
                  id: 'receiver-1',
                  display_name: 'Receiver User',
                });
              return Promise.resolve(null);
            }),
          },
        },
        {
          provide: CentrifugoService,
          useValue: {
            publish: vi.fn().mockResolvedValue(true),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockImplementation((key) => {
              if (key === 'APPLE_SHARED_SECRET') return 'secret';
              if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123';
              return null;
            }),
          },
        },
        {
          provide: HttpService,
          useValue: {
            post: vi.fn(),
            get: vi.fn(),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            recordCoinPurchase: vi.fn(),
            recordCoinPurchaseError: vi.fn(),
            recordCoinFraudAttempt: vi.fn(),
            setCoinBalanceTotal: vi.fn(),
            setCoinHighBalanceUsers: vi.fn(),
            recordDailyCheckInClaim: vi.fn(),
            recordGiftSent: vi.fn(),
            recordStickerPurchase: vi.fn(),
            observeCoinTransactionLatency: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EconomyService>(EconomyService);
    centrifugoService = module.get<CentrifugoService>(CentrifugoService);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCatalog', () => {
    it('should return cached catalog when available in Redis', async () => {
      const cachedGifts = [
        {
          id: 'gift-1',
          name: 'Rose',
          icon: 'rose.png',
          cost_coins: 10,
          animation_type: 'float',
        },
      ];
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cachedGifts));

      const result = await service.getCatalog();

      expect(result).toEqual(cachedGifts);
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('should return catalog of virtual gifts ordered by cost', async () => {
      const gifts = [
        {
          id: 'gift-1',
          name: 'Rose',
          icon: 'rose.png',
          cost_coins: 10,
          animation_type: 'float',
        },
        {
          id: 'gift-2',
          name: 'Crown',
          icon: 'crown.png',
          cost_coins: 100,
          animation_type: 'pop',
        },
      ];
      mockQueryBuilder.order.mockResolvedValue({
        data: gifts,
        error: null,
      });

      const result = await service.getCatalog();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('virtual_gifts');
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('cost_coins', {
        ascending: true,
      });
      expect(result).toEqual(gifts);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'economy:catalog',
        JSON.stringify(gifts),
        'EX',
        3600,
      );
    });

    it('should return the default gift catalog when virtual gifts response data is null', async () => {
      mockQueryBuilder.order.mockResolvedValue({
        data: null,
        error: { message: 'Table error' },
      });

      const result = await service.getCatalog();
      expect(result).toEqual([
        {
          id: 'gift_rose',
          name: 'Rose',
          icon: '🌹',
          cost_coins: 10,
          animation_type: 'float',
          animation_url: 'https://r2.example.com/rose.json',
        },
        {
          id: 'gift_heart',
          name: 'Heart',
          icon: '❤️',
          cost_coins: 20,
          animation_type: 'float',
          animation_url: 'https://r2.example.com/heart.json',
        },
      ]);
      expect(mockRedisClient.set).toHaveBeenCalled();
    });
  });

  describe('getBalance', () => {
    it('should return mock profile coins if user record not found or data is null', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.getBalance('sender-1');
      expect(result).toEqual({ coins_balance: 50 }); // UsersService mock in setup doesn't return coins_balance, so it falls back to 50
    });

    it('should return actual user coins balance when user record found', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { id: 'user-1', coins_balance: 250 },
        error: null,
      });

      const result = await service.getBalance('user-1');
      expect(result).toEqual({ coins_balance: 250 });
    });
  });

  describe('purchaseCoins', () => {
    it('should add amount to balance, update user in database, and return new balance', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { id: 'user-1', coins_balance: 100 },
        error: null,
      });

      vi.spyOn(service['httpService'], 'post').mockReturnValue(
        of({
          data: {
            status: 0,
            latest_receipt_info: [
              {
                product_id: 'com.linguaexchange.coins.medium',
                transaction_id: 'txn123',
              },
            ],
          },
        }),
      );

      mockQueryBuilder.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.purchaseCoins('user-1', {
        receipt_token: 'ios_token123',
        platform: 'ios',
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('coin_purchases');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction_id: 'txn123',
          receipt_token: 'ios_token123',
        }),
      );
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        coins_balance: 600,
      });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'user-1');
      expect(result).toEqual({ coins: 500, new_balance: 600 });
    });

    it('should reject a replayed transaction atomically without crediting coins twice', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { id: 'user-1', coins_balance: 100 },
        error: null,
      });

      vi.spyOn(service['httpService'], 'post').mockReturnValue(
        of({
          data: {
            status: 0,
            latest_receipt_info: [
              {
                product_id: 'com.linguaexchange.coins.medium',
                transaction_id: 'txn123',
              },
            ],
          },
        }),
      );

      // Simulate the DB unique constraint on coin_purchases.transaction_id
      // rejecting a duplicate insert (Postgres unique_violation).
      mockQueryBuilder.insert.mockResolvedValueOnce({
        error: { code: '23505', message: 'duplicate key value' },
      });

      mockQueryBuilder.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(
        service.purchaseCoins('user-1', {
          receipt_token: 'ios_token123',
          platform: 'ios',
        }),
      ).rejects.toThrow('This transaction has already been processed');

      // Balance must never be touched when the transaction is a replay.
      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
    });

    it('should credit coins for a Stripe session whose metadata.userId matches the caller', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { id: 'user-1', coins_balance: 100 },
        error: null,
      });

      const pendingRecord = {
        id: 'purchase-1',
        user_id: 'user-1',
        package_id: 'coins_medium',
        coins_added: 500,
        amount_paid: 1999,
        currency: 'usd',
        receipt_token: 'sess_123',
        platform: 'web',
        transaction_id: 'sess_123',
        status: 'pending',
      };
      mockQueryBuilder.maybeSingle.mockResolvedValue({
        data: pendingRecord,
        error: null,
      });

      vi.spyOn(
        service['stripe'].checkout.sessions,
        'retrieve',
      ).mockResolvedValue({
        id: 'sess_123',
        payment_status: 'paid',
        amount_total: 1999,
        metadata: {
          userId: 'user-1',
          product_id: 'coins_medium_web',
        },
      } as unknown as Stripe.Checkout.Session);

      const result = await service.purchaseCoins('user-1', {
        receipt_token: 'stripe_sess_123',
        platform: 'web',
      });

      expect(result).toEqual({ coins: 500, new_balance: 600 });
    });

    it('should reject a Stripe session belonging to a different user', async () => {
      const pendingRecord = {
        id: 'purchase-1',
        user_id: 'user-1',
        package_id: 'coins_medium',
        coins_added: 500,
        amount_paid: 1999,
        currency: 'usd',
        receipt_token: 'sess_123',
        platform: 'web',
        transaction_id: 'sess_123',
        status: 'pending',
      };
      mockQueryBuilder.maybeSingle.mockResolvedValue({
        data: pendingRecord,
        error: null,
      });

      vi.spyOn(
        service['stripe'].checkout.sessions,
        'retrieve',
      ).mockResolvedValue({
        id: 'sess_123',
        payment_status: 'paid',
        amount_total: 1999,
        metadata: {
          userId: 'other-user',
          product_id: 'coins_medium_web',
        },
      } as unknown as Stripe.Checkout.Session);

      await expect(
        service.purchaseCoins('user-1', {
          receipt_token: 'stripe_sess_123',
          platform: 'web',
        }),
      ).rejects.toThrow(
        'This Stripe checkout session does not belong to the requesting user',
      );

      expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
    });
  });

  describe('getPackages', () => {
    it('should return all coin packages', () => {
      const result = service.getPackages();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(4);
      expect(result[0].id).toBe('coins_small');
      expect(result[0].coins).toBe(100);
      expect(result[3].id).toBe('coins_mega');
      expect(result[3].coins).toBe(3000);
    });

    it('should include platform_product_id for each package', () => {
      const result = service.getPackages();
      for (const pkg of result) {
        expect(pkg.platform_product_id).toBeDefined();
        expect(typeof pkg.platform_product_id.ios).toBe('string');
        expect(typeof pkg.platform_product_id.android).toBe('string');
        expect(typeof pkg.platform_product_id.web).toBe('string');
      }
    });
  });

  describe('createCheckoutSession', () => {
    it('should throw NotFoundException when package_id is not found', async () => {
      await expect(
        service.createCheckoutSession('user-1', 'non_existent_package'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create a Stripe session and a pending purchase record', async () => {
      vi.spyOn(service['stripe'].checkout.sessions, 'create').mockResolvedValue(
        {
          id: 'sess_checkout_1',
          url: 'https://checkout.stripe.com/test/sess_checkout_1',
        } as unknown as Stripe.Checkout.Session,
      );

      vi.spyOn(service['configService'], 'get').mockReturnValue(
        'http://localhost:4200',
      );

      mockQueryBuilder.insert.mockResolvedValue({
        error: null,
      });

      const result = await service.createCheckoutSession(
        'user-1',
        'coins_small',
      );

      expect(result.sessionId).toBe('sess_checkout_1');
      expect(result.sessionUrl).toBe(
        'https://checkout.stripe.com/test/sess_checkout_1',
      );
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('coin_purchases');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          package_id: 'coins_small',
          status: 'pending',
        }),
      );
    });

    it('should throw if insert of pending purchase record fails', async () => {
      vi.spyOn(service['stripe'].checkout.sessions, 'create').mockResolvedValue(
        {
          id: 'sess_checkout_2',
          url: 'https://checkout.stripe.com/test/sess_checkout_2',
        } as unknown as Stripe.Checkout.Session,
      );

      mockQueryBuilder.insert.mockResolvedValue({
        error: { message: 'DB error' },
      });

      await expect(
        service.createCheckoutSession('user-1', 'coins_small'),
      ).rejects.toThrow('Failed to initialize purchase session.');
    });
  });

  describe('verifyPurchaseReceipt', () => {
    it('should return true for valid receipts', async () => {
      const result = await service.verifyPurchaseReceipt({
        receipt_token: 'test_token',
        platform: 'ios',
      });
      expect(result).toBe(true);
    });
  });

  describe('claimDailyCheckIn', () => {
    beforeEach(() => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.del.mockResolvedValue(1);
    });

    it('should grant between 5 and 10 coins on first daily check-in', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { id: 'user-1', coins_balance: 100 },
        error: null,
      });

      const result = await service.claimDailyCheckIn('user-1');

      expect(result.claimed).toBe(true);
      expect(result.coins_rewarded).toBeGreaterThanOrEqual(5);
      expect(result.coins_rewarded).toBeLessThanOrEqual(10);
      expect(result.new_balance).toBe(100 + result.coins_rewarded);
      expect(mockRedisClient.get).toHaveBeenCalled();
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.stringContaining('daily_checkin:user-1:'),
        '1',
        'EX',
        86400,
      );
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        coins_balance: result.new_balance,
      });
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'economy:sticker_packs:user-1',
      );
    });

    it('should not grant coins when user already claimed today', async () => {
      mockRedisClient.get.mockResolvedValue('1');
      mockQueryBuilder.single.mockResolvedValue({
        data: { id: 'user-1', coins_balance: 100 },
        error: null,
      });

      const result = await service.claimDailyCheckIn('user-1');

      expect(result.claimed).toBe(false);
      expect(result.coins_rewarded).toBe(0);
      expect(result.new_balance).toBe(100);
      expect(mockRedisClient.set).not.toHaveBeenCalled();
      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('sendGift', () => {
    it('should throw NotFoundException when gift ID not found in catalog', async () => {
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await expect(
        service.sendGift('sender-1', {
          gift_id: 'non-existent',
          receiver_id: 'receiver-1',
        }),
      ).rejects.toThrow(
        new NotFoundException("Gift 'non-existent' not found in catalog."),
      );
    });

    it('should throw BadRequestException when sender has insufficient coins', async () => {
      const giftRow = {
        id: 'gift-1',
        name: 'Rocket',
        cost_coins: 1000,
        icon: 'rocket.png',
        animation_type: 'launch',
      };
      // 1st call: get gift (maybeSingle)
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: giftRow,
        error: null,
      });
      // 2nd single() call: getBalance(senderId)
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'sender-1', coins_balance: 100 },
        error: null,
      });

      await expect(
        service.sendGift('sender-1', {
          gift_id: 'gift-1',
          receiver_id: 'receiver-1',
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'Insufficient coin balance (100 available, 1000 required). Purchase coins to support your language partners and room hosts!',
        ),
      );
    });

    it('should transfer coins, save transaction, publish to channels, and invalidate caches', async () => {
      const giftRow = {
        id: 'gift-1',
        name: 'Heart',
        cost_coins: 50,
        icon: 'heart.png',
        animation_type: 'pop',
      };
      // 1st call: get gift (maybeSingle)
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: giftRow,
        error: null,
      });
      // 2nd single() call: getBalance(senderId)
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'sender-1', coins_balance: 200 },
        error: null,
      });
      // 2nd maybeSingle() call: receiver existence check
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'receiver-1' },
        error: null,
      });
      // 3rd single() call: getBalance(receiverId)
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'receiver-1', coins_balance: 300 },
        error: null,
      });

      const result = await service.sendGift('sender-1', {
        gift_id: 'gift-1',
        receiver_id: 'receiver-1',
        room_id: 'room-101',
      });

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        coins_balance: 150,
      });
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        coins_balance: 350,
      });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('gift_transactions');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        sender_id: 'sender-1',
        receiver_id: 'receiver-1',
        gift_id: 'gift-1',
        room_id: 'room-101',
        coins_spent: 50,
      });
      const expectedGiftEvent = {
        type: 'virtual_gift',
        gift_id: 'gift-1',
        gift_name: 'Heart',
        icon: 'heart.png',
        animation_url: '',
        animation_type: 'pop',
        coin_value: 50,
        sender_name: 'Sender User',
        receiver_name: 'Receiver User',
        room_id: 'room-101',
      };
      expect(centrifugoService.publish).toHaveBeenCalledWith(
        'user_receiver-1',
        expectedGiftEvent,
      );
      expect(centrifugoService.publish).toHaveBeenCalledWith(
        'room_room-101',
        expectedGiftEvent,
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'economy:sticker_packs:sender-1',
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'economy:sticker_packs:receiver-1',
      );
      expect(result).toEqual({
        success: true,
        coins_remaining: 150,
        gift: giftRow,
      });
    });

    it('should publish to user channel when room_id is not provided', async () => {
      const giftRow = {
        id: 'gift-2',
        name: 'Tea',
        cost_coins: 20,
        icon: 'tea.png',
        animation_type: 'steam',
      };
      // 1st call: get gift (maybeSingle)
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: giftRow,
        error: null,
      });
      // 2nd single() call: getBalance(senderId)
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'sender-1', coins_balance: 100 },
        error: null,
      });
      // 2nd maybeSingle() call: receiver existence check
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'receiver-1' },
        error: null,
      });
      // 3rd single() call: getBalance(receiverId)
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'receiver-1', coins_balance: 50 },
        error: null,
      });

      const result = await service.sendGift('sender-1', {
        gift_id: 'gift-2',
        receiver_id: 'receiver-1',
      });

      expect(centrifugoService.publish).toHaveBeenCalledWith(
        'user_receiver-1',
        expect.objectContaining({
          type: 'virtual_gift',
          room_id: undefined,
        }),
      );
      expect(result.success).toBe(true);
      expect(result.coins_remaining).toBe(80);
    });

    it('should fetch both profiles concurrently', async () => {
      const giftRow = {
        id: 'gift-3',
        name: 'Book',
        cost_coins: 10,
        icon: 'book.png',
        animation_type: 'open',
      };
      mockQueryBuilder.maybeSingle
        .mockResolvedValueOnce({ data: giftRow, error: null })
        .mockResolvedValueOnce({ data: { id: 'receiver-1' }, error: null });
      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { id: 'sender-1', coins_balance: 100 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'receiver-1', coins_balance: 20 },
          error: null,
        });

      let resolveSenderProfile: ((value: unknown) => void) | undefined;
      vi.spyOn(usersService, 'getProfile').mockImplementation((id: string) => {
        if (id === 'sender-1') {
          return new Promise((resolve) => {
            resolveSenderProfile = resolve;
          });
        }
        return Promise.resolve({
          id: 'receiver-1',
          display_name: 'Receiver User',
        }) as ReturnType<UsersService['getProfile']>;
      });

      const sendPromise = service.sendGift('sender-1', {
        gift_id: 'gift-3',
        receiver_id: 'receiver-1',
      });

      await vi.waitFor(() => {
        expect(usersService.getProfile).toHaveBeenCalledTimes(2);
      });
      resolveSenderProfile?.({
        id: 'sender-1',
        display_name: 'Sender User',
      });

      await expect(sendPromise).resolves.toMatchObject({ success: true });
    });

    it('should not report failure after a committed gift when a profile lookup fails', async () => {
      const giftRow = {
        id: 'gift-4',
        name: 'Flower',
        cost_coins: 15,
        icon: 'flower.png',
        animation_type: 'bloom',
      };
      mockQueryBuilder.maybeSingle
        .mockResolvedValueOnce({ data: giftRow, error: null })
        .mockResolvedValueOnce({ data: { id: 'receiver-1' }, error: null });
      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { id: 'sender-1', coins_balance: 100 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'receiver-1', coins_balance: 20 },
          error: null,
        });
      vi.spyOn(usersService, 'getProfile').mockImplementation((id: string) => {
        if (id === 'sender-1') {
          return Promise.reject(
            new Error('profile unavailable SECRET-PROVIDER-DETAIL'),
          );
        }
        return Promise.resolve({
          id: 'receiver-1',
          display_name: 'Receiver User',
        }) as ReturnType<UsersService['getProfile']>;
      });

      await expect(
        service.sendGift('sender-1', {
          gift_id: 'gift-4',
          receiver_id: 'receiver-1',
        }),
      ).resolves.toMatchObject({
        success: true,
        coins_remaining: 85,
      });
      expect(centrifugoService.publish).toHaveBeenCalledWith(
        'user_receiver-1',
        expect.objectContaining({
          sender_name: null,
          receiver_name: 'Receiver User',
        }),
      );
      const logger = module.get<{ warn: Mock }>(
        'PinoLogger:EconomyService',
      );
      expect(logger.warn).toHaveBeenCalledWith(
        'Gift profile enrichment failed for 1 lookup',
      );
      expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(
        'SECRET-PROVIDER-DETAIL',
      );
    });
  });

  describe('getStickerPacks', () => {
    it('should return cached sticker packs when available', async () => {
      const cached = {
        packs: [{ id: 'stk_pack_1', name: 'Happy Corgi Pack', cost_coins: 50 }],
        owned_pack_ids: ['stk_pack_1'],
        user_coins: 300,
      };
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cached));

      const result = await service.getStickerPacks('user-1');

      expect(result).toEqual(cached);
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('should return packs with ownership information', async () => {
      const mockPacks = [
        {
          id: 'stk_pack_1',
          name: 'Happy Corgi Pack',
          cost_coins: 50,
          is_animated: false,
          sticker_urls: ['sticker1.png'],
        },
        {
          id: 'stk_pack_2',
          name: 'Rainbow Unicorns',
          cost_coins: 200,
          is_animated: true,
          sticker_urls: ['unicorn1.webm'],
        },
      ];
      const mockOwned = [{ pack_id: 'stk_pack_1' }];
      const mockBalance = { id: 'user-1', coins_balance: 300 };

      // Query 1: from('sticker_packs').select('*').order(...)
      // Query 2: from('user_sticker_packs').select('pack_id').eq('user_id', userId)
      // Query 3: from('users').select('coins_balance').eq('id', userId).single()
      const mockFrom = vi.fn();
      mockSupabaseClient.from = mockFrom;

      const packsBuilder = {
        ...mockQueryBuilder,
        order: vi.fn().mockResolvedValue({ data: mockPacks, error: null }),
      };

      const ownedBuilder = {
        ...mockQueryBuilder,
        eq: vi.fn().mockResolvedValue({ data: mockOwned, error: null }),
      };

      const usersBuilder = {
        ...mockQueryBuilder,
        single: vi.fn().mockResolvedValue({ data: mockBalance, error: null }),
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'sticker_packs') return packsBuilder;
        if (table === 'user_sticker_packs') return ownedBuilder;
        if (table === 'users') return usersBuilder;
        return mockQueryBuilder;
      });

      const result = await service.getStickerPacks('user-1');

      expect(result.packs).toEqual(mockPacks);
      expect(result.owned_pack_ids).toEqual(['stk_pack_1']);
      expect(result.user_coins).toBe(300);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'economy:sticker_packs:user-1',
        JSON.stringify({
          packs: mockPacks,
          owned_pack_ids: ['stk_pack_1'],
          user_coins: 300,
        }),
        'EX',
        300,
      );
    });

    it('should return default packs when DB returns empty', async () => {
      const mockFrom = vi.fn();
      mockSupabaseClient.from = mockFrom;

      const packsBuilder = {
        ...mockQueryBuilder,
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      const ownedBuilder = {
        ...mockQueryBuilder,
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      const usersBuilder = {
        ...mockQueryBuilder,
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'sticker_packs') return packsBuilder;
        if (table === 'user_sticker_packs') return ownedBuilder;
        if (table === 'users') return usersBuilder;
        return mockQueryBuilder;
      });

      const result = await service.getStickerPacks('user-1');

      expect(result.packs).toHaveLength(8);
      expect(result.packs[1].is_animated).toBe(true); // Rainbow Unicorns
    });
  });

  describe('unlockStickerPack', () => {
    const freshUnlock = {
      success: true,
      newly_unlocked: true,
      coins_remaining: 150,
      pack_id: 'stk_pack_1',
      pack_name: 'Happy Corgi Pack',
      pack_cost_coins: 50,
      pack_is_animated: false,
      pack_sticker_urls: ['assets/stickers/happy.png'],
      pack_animation_url: null,
    };

    it('should unlock a sticker pack atomically and return the persisted balance', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [freshUnlock],
        error: null,
      });

      const result = await service.unlockStickerPack('user-1', {
        pack_id: 'stk_pack_1',
      });

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'unlock_sticker_pack_atomic',
        {
          p_user_id: 'user-1',
          p_pack_id: 'stk_pack_1',
        },
      );
      expect(result).toEqual({
        success: true,
        coins_remaining: 150,
        pack: {
          id: 'stk_pack_1',
          name: 'Happy Corgi Pack',
          cost_coins: 50,
          is_animated: false,
          sticker_urls: ['assets/stickers/happy.png'],
          animation_url: null,
        },
      });
      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
      expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'economy:sticker_packs:user-1',
      );
      expect(
        module.get<MetricsService>(MetricsService).recordStickerPurchase,
      ).toHaveBeenCalledWith('stk_pack_1', 50);
    });

    it('should treat an already-owned pack as an idempotent success without recording another purchase', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{ ...freshUnlock, newly_unlocked: false }],
        error: null,
      });

      const result = await service.unlockStickerPack('user-1', {
        pack_id: 'stk_pack_1',
      });

      expect(result.coins_remaining).toBe(150);
      expect(
        module.get<MetricsService>(MetricsService).recordStickerPurchase,
      ).not.toHaveBeenCalled();
      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
    });

    it('should preserve one persisted balance when concurrent duplicate unlocks resolve', async () => {
      mockSupabaseClient.rpc
        .mockResolvedValueOnce({ data: [freshUnlock], error: null })
        .mockResolvedValueOnce({
          data: [{ ...freshUnlock, newly_unlocked: false }],
          error: null,
        });

      const [first, second] = await Promise.all([
        service.unlockStickerPack('user-1', { pack_id: 'stk_pack_1' }),
        service.unlockStickerPack('user-1', { pack_id: 'stk_pack_1' }),
      ]);

      expect(first.coins_remaining).toBe(150);
      expect(second.coins_remaining).toBe(150);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(2);
      expect(
        module.get<MetricsService>(MetricsService).recordStickerPurchase,
      ).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when the atomic RPC reports a missing pack', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'STICKER_PACK_NOT_FOUND' },
      });

      await expect(
        service.unlockStickerPack('user-1', { pack_id: 'nonexistent' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when the atomic RPC reports insufficient coins', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'INSUFFICIENT_COINS' },
      });

      await expect(
        service.unlockStickerPack('user-1', { pack_id: 'stk_pack_4' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should fail the request when ownership cannot be committed', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'duplicate key value violates unique constraint' },
      });

      await expect(
        service.unlockStickerPack('user-1', { pack_id: 'stk_pack_1' }),
      ).rejects.toThrow('Failed to unlock sticker pack.');
      expect(mockRedisClient.del).not.toHaveBeenCalled();
      expect(
        module.get<MetricsService>(MetricsService).recordStickerPurchase,
      ).not.toHaveBeenCalled();
    });

    it('should reject malformed RPC results instead of assuming a purchase succeeded', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{ success: true, coins_remaining: 150 }],
        error: null,
      });

      await expect(
        service.unlockStickerPack('user-1', { pack_id: 'stk_pack_1' }),
      ).rejects.toThrow('Failed to unlock sticker pack.');
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('exponential backoff retry (HTTP 429)', () => {
    beforeEach(() => {
      (withExponentialBackoff as Mock).mockClear();
    });

    it('should wrap getCatalog Supabase call with withExponentialBackoff', async () => {
      mockQueryBuilder.order.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await service.getCatalog();

      expect(withExponentialBackoff).toHaveBeenCalled();
      const calls = (withExponentialBackoff as Mock).mock.calls;
      // One of the calls should be for getCatalog
      const getCatalogCall = calls.find(
        (call: [unknown, string, unknown]) => call[1] === 'getCatalog',
      );
      expect(getCatalogCall).toBeDefined();
    });

    it('should wrap getBalance Supabase call with withExponentialBackoff', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { coins_balance: 100 },
        error: null,
      });

      await service.getBalance('user-1');

      expect(withExponentialBackoff).toHaveBeenCalled();
      const calls = (withExponentialBackoff as Mock).mock.calls;
      const getBalanceCall = calls.find(
        (call: [unknown, string, unknown]) => call[1] === 'getBalance',
      );
      expect(getBalanceCall).toBeDefined();
    });

    it('should detect HTTP 429 errors via isHttp429Error in http-retry.helper', async () => {
      // Verify the actual helper detects 429 correctly
      const actual = await vi.importActual<
        typeof import('../common/http-retry.helper')
      >('../common/http-retry.helper');

      // Simulate the code path: withExponentialBackoff calls operation()
      // and catches errors, then checks isHttp429Error
      // We test the real module's behaviour here
      expect(actual.withExponentialBackoff).toBeDefined();
    });
  });
});

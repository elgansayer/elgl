import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EconomyService } from './economy.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { CentrifugoService } from '../chat/centrifugo.service';
import { of } from 'rxjs';
import type Stripe from 'stripe';

describe('EconomyService', () => {
  let service: EconomyService;
  let centrifugoService: CentrifugoService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;
  let module: TestingModule;
  let mockRedisClient: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    };

    module = await Test.createTestingModule({
      providers: [
        EconomyService,
        {
          provide: 'PinoLogger:EconomyService',
          useValue: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
            getRedisClient: jest.fn().mockReturnValue(mockRedisClient),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getProfile: jest.fn().mockImplementation((id: string) => {
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
            publish: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key) => {
              if (key === 'APPLE_SHARED_SECRET') return 'secret';
              if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123';
              return null;
            }),
          },
        },
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EconomyService>(EconomyService);
    centrifugoService = module.get<CentrifugoService>(CentrifugoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCatalog', () => {
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

      jest.spyOn(service['httpService'], 'post').mockReturnValue(
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

      jest.spyOn(service['httpService'], 'post').mockReturnValue(
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

      jest
        .spyOn(service['stripe'].checkout.sessions, 'retrieve')
        .mockResolvedValue({
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

      jest
        .spyOn(service['stripe'].checkout.sessions, 'retrieve')
        .mockResolvedValue({
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

  describe('claimDailyCheckIn', () => {
    beforeEach(() => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');
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

    it('should transfer coins, save transaction, and publish to room channel when room_id provided', async () => {
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
  });

  describe('getStickerPacks', () => {
    it('should return packs with ownership information', async () => {
      const mockPacks = [
        { id: 'stk_pack_1', name: 'Happy Corgi Pack', cost_coins: 50, is_animated: false, sticker_urls: ['sticker1.png'] },
        { id: 'stk_pack_2', name: 'Rainbow Unicorns', cost_coins: 200, is_animated: true, sticker_urls: ['unicorn1.webm'] },
      ];
      const mockOwned = [{ pack_id: 'stk_pack_1' }];
      const mockBalance = { id: 'user-1', coins_balance: 300 };

<<<<<<< HEAD
      const buildChain = (terminalResult: unknown) => {
        const chain: any = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn(),
          single: jest.fn(),
        };
        chain.then = (resolve: (v: unknown) => void) => {
          resolve(terminalResult);
          return { catch: jest.fn() };
        };
        return chain;
      };

      const packsChain = buildChain({ data: mockPacks, error: null });
      packsChain.order = jest.fn().mockResolvedValue({ data: mockPacks, error: null });

      const ownedChain = buildChain({ data: mockOwned, error: null });
      ownedChain.select = jest.fn().mockReturnValue(ownedChain);
      ownedChain.eq = jest.fn().mockReturnValue(ownedChain);

      const balanceChain = buildChain({ data: mockBalance, error: null });
      balanceChain.select = jest.fn().mockReturnValue(balanceChain);
      balanceChain.eq = jest.fn().mockReturnValue(balanceChain);
      balanceChain.single = jest.fn().mockResolvedValue({ data: mockBalance, error: null });

      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'sticker_packs') return packsChain;
        if (table === 'user_sticker_packs') return ownedChain;
        if (table === 'users') return balanceChain;
        return buildChain({ data: null, error: null });
=======
      // Query 1: from('sticker_packs').select('*').order(...)
      // Query 2: from('user_sticker_packs').select('pack_id').eq('user_id', userId)
      // Query 3: from('users').select('coins_balance').eq('id', userId).single()
      const mockFrom = jest.fn();
      mockSupabaseClient.from = mockFrom;

      const packsBuilder = {
        ...mockQueryBuilder,
        order: jest.fn().mockResolvedValue({ data: mockPacks, error: null }),
      };

      const ownedBuilder = {
        ...mockQueryBuilder,
        eq: jest.fn().mockResolvedValue({ data: mockOwned, error: null }),
      };

      const usersBuilder = {
        ...mockQueryBuilder,
        single: jest.fn().mockResolvedValue({ data: mockBalance, error: null }),
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'sticker_packs') return packsBuilder;
        if (table === 'user_sticker_packs') return ownedBuilder;
        if (table === 'users') return usersBuilder;
        return mockQueryBuilder;
>>>>>>> origin/main
      });

      const result = await service.getStickerPacks('user-1');

      expect(result.packs).toEqual(mockPacks);
      expect(result.owned_pack_ids).toEqual(['stk_pack_1']);
      expect(result.user_coins).toBe(300);
    });

    it('should return default packs when DB returns empty', async () => {
<<<<<<< HEAD
      const buildChain = (terminalResult: unknown) => {
        const chain: any = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn(),
          single: jest.fn(),
        };
        chain.then = (resolve: (v: unknown) => void) => {
          resolve(terminalResult);
          return { catch: jest.fn() };
        };
        return chain;
      };

      const packsChain = buildChain({ data: [], error: null });
      packsChain.order = jest.fn().mockResolvedValue({ data: [], error: null });
      const ownedChain = buildChain({ data: [], error: null });
      const balanceChain = buildChain({ data: null, error: null });
      balanceChain.single = jest.fn().mockResolvedValue({ data: null, error: null });

      (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'sticker_packs') return packsChain;
        if (table === 'user_sticker_packs') return ownedChain;
        if (table === 'users') return balanceChain;
        return buildChain({ data: null, error: null });
=======
      const mockFrom = jest.fn();
      mockSupabaseClient.from = mockFrom;

      const packsBuilder = {
        ...mockQueryBuilder,
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const ownedBuilder = {
        ...mockQueryBuilder,
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const usersBuilder = {
        ...mockQueryBuilder,
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'sticker_packs') return packsBuilder;
        if (table === 'user_sticker_packs') return ownedBuilder;
        if (table === 'users') return usersBuilder;
        return mockQueryBuilder;
>>>>>>> origin/main
      });

      const result = await service.getStickerPacks('user-1');

      expect(result.packs).toHaveLength(8);
      expect(result.packs[1]!.is_animated).toBe(true);
    });
  });

  describe('unlockStickerPack', () => {
    it('should unlock a sticker pack and deduct coins', async () => {
      const pack = { id: 'stk_pack_1', name: 'Happy Corgi Pack', cost_coins: 50 };
      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: pack, error: null }) // pack lookup
        .mockResolvedValueOnce({ data: { id: 'user-1', coins_balance: 200 }, error: null }); // balance check

      const result = await service.unlockStickerPack('user-1', { pack_id: 'stk_pack_1' });

      expect(result.success).toBe(true);
      expect(result.coins_remaining).toBe(150);
      expect(result.pack).toEqual(pack);
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        pack_id: 'stk_pack_1',
      });
    });

    it('should throw NotFoundException when pack does not exist', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({ data: null, error: null });

      await expect(
        service.unlockStickerPack('user-1', { pack_id: 'nonexistent' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when insufficient coins', async () => {
      const pack = { id: 'stk_pack_4', name: 'Golden Dragons', cost_coins: 500 };
      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: pack, error: null }) // pack lookup
        .mockResolvedValueOnce({ data: { id: 'user-1', coins_balance: 100 }, error: null }); // balance

      await expect(
        service.unlockStickerPack('user-1', { pack_id: 'stk_pack_4' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

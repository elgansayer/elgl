import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EconomyService } from './economy.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { CentrifugoService } from '../chat/centrifugo.service';
import { of } from 'rxjs';

describe('EconomyService', () => {
  let service: EconomyService;
  let centrifugoService: CentrifugoService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EconomyService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
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
        { id: 'gift-1', name: 'Rose', cost_coins: 10 },
        { id: 'gift-2', name: 'Crown', cost_coins: 100 },
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

    it('should return empty array when virtual gifts response data is null', async () => {
      mockQueryBuilder.order.mockResolvedValue({
        data: null,
        error: { message: 'Table error' },
      });

      const result = await service.getCatalog();
      expect(result).toEqual([]);
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

      // Mock checkDuplicateTransaction
      mockQueryBuilder.maybeSingle = jest
        .fn()
        .mockResolvedValue({ data: null });

      const result = await service.purchaseCoins('user-1', {
        amount: 500,
        package_id: 'coins_medium',
        receipt_token: 'ios_token123',
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        coins_balance: 600,
      });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'user-1');
      expect(result).toEqual({ coins: 500, newBalance: 600 });
    });
  });

  describe('sendGift', () => {
    it('should throw NotFoundException when gift ID not found in catalog', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
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
      const giftRow = { id: 'gift-1', name: 'Rocket', cost_coins: 1000 };
      // 1st single() call: get gift
      mockQueryBuilder.single.mockResolvedValueOnce({
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
      // 1st single() call: get gift
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: giftRow,
        error: null,
      });
      // 2nd single() call: getBalance(senderId)
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'sender-1', coins_balance: 200 },
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
      expect(centrifugoService.publish).toHaveBeenCalledWith('room_room-101', {
        type: 'virtual_gift',
        gift: giftRow,
        sender_name: 'Sender User',
        receiver_name: 'Receiver User',
        room_id: 'room-101',
      });
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
      // 1st single() call: get gift
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: giftRow,
        error: null,
      });
      // 2nd single() call: getBalance(senderId)
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'sender-1', coins_balance: 100 },
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
});

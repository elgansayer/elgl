import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { SupabaseService } from '../supabase/supabase.service';
import { EscrowStatus } from './interfaces/escrow.interface';

describe('EscrowService', () => {
  let service: EscrowService;

  let mockSupabaseClient: any;

  let mockQueryBuilder: any;
  let mockRedisClient: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    keys: jest.Mock;
  };

  beforeEach(async () => {
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
      ilike: jest.fn().mockReturnThis(),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
            getRedisClient: jest.fn().mockReturnValue(mockRedisClient),
          },
        },
      ],
    }).compile();

    service = module.get<EscrowService>(EscrowService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createEscrow', () => {
    const escrowRow = {
      id: 'escrow-1',
      payer_id: 'payer-1',
      payee_id: 'payee-1',
      amount_coins: 100,
      status: EscrowStatus.HELD,
      reference_type: 'session',
      reference_id: 'session-1',
      held_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      released_at: null,
      refunded_at: null,
      cancelled_at: null,
      dispute_reason: null,
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it('should create an escrow payment and deduct coins', async () => {
      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: { coins_balance: 500 }, error: null }) // payer balance check
        .mockResolvedValueOnce({ data: { id: 'payee-1' }, error: null }) // payee exists check
        .mockResolvedValueOnce({ data: escrowRow, error: null }); // escrow insert return

      const result = await service.createEscrow('payer-1', {
        payee_id: 'payee-1',
        amount_coins: 100,
        reference_type: 'session',
        reference_id: 'session-1',
      });

      expect(result).toEqual(escrowRow);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        coins_balance: 400,
      });
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          payer_id: 'payer-1',
          payee_id: 'payee-1',
          amount_coins: 100,
          status: EscrowStatus.HELD,
        }),
      );
      expect(mockRedisClient.keys).toHaveBeenCalled();
    });

    it('should throw BadRequestException when creating escrow with self', async () => {
      await expect(
        service.createEscrow('payer-1', {
          payee_id: 'payer-1',
          amount_coins: 100,
          reference_type: 'session',
          reference_id: 'session-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when insufficient balance', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { coins_balance: 50 },
        error: null,
      });

      await expect(
        service.createEscrow('payer-1', {
          payee_id: 'payee-1',
          amount_coins: 100,
          reference_type: 'session',
          reference_id: 'session-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should rollback coin deduction on escrow insert failure', async () => {
      // Step 1: payer balance check
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { coins_balance: 500 },
        error: null,
      });
      // Step 2: payee exists check
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'payee-1' },
        error: null,
      });

      // Spy on from() to return special builders for each table
      const updateCalls: Array<Record<string, unknown>> = [];
      const mockFrom = jest.fn().mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
            eq: jest.fn().mockReturnThis(),
            single: mockQueryBuilder.single,
          };
        }
        if (table === 'escrow_payments') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'insert error' },
                }),
              }),
            }),
          };
        }
        return mockQueryBuilder;
      });

      mockSupabaseClient.from = mockFrom;

      await expect(
        service.createEscrow('payer-1', {
          payee_id: 'payee-1',
          amount_coins: 100,
          reference_type: 'session',
          reference_id: 'session-1',
        }),
      ).rejects.toThrow(BadRequestException);

      // Verify the users table was called to rollback:
      // The update for rollback should restore coins_balance to 500
      expect(mockFrom).toHaveBeenCalledWith('users');
    });
  });

  describe('resolveEscrow', () => {
    const heldEscrow = {
      id: 'escrow-1',
      payer_id: 'payer-1',
      payee_id: 'payee-1',
      amount_coins: 100,
      status: EscrowStatus.HELD,
      reference_type: 'session',
      reference_id: 'session-1',
      held_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      released_at: null,
      refunded_at: null,
      cancelled_at: null,
      dispute_reason: null,
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it('should release escrow when payee requests release', async () => {
      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: heldEscrow, error: null }) // getEscrowByIdInternal
        .mockResolvedValueOnce({
          data: { coins_balance: 200 },
          error: null,
        }) // payee balance fetch
        .mockResolvedValueOnce({
          data: {
            ...heldEscrow,
            status: EscrowStatus.RELEASED,
            released_at: new Date().toISOString(),
          },
          error: null,
        }); // update result

      const result = await service.resolveEscrow('escrow-1', 'payee-1', {
        action: 'release',
      });

      expect(result.status).toBe(EscrowStatus.RELEASED);
      expect(mockRedisClient.keys).toHaveBeenCalled();
    });

    it('should refund escrow when payer requests refund', async () => {
      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: heldEscrow, error: null })
        .mockResolvedValueOnce({
          data: { coins_balance: 200 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            ...heldEscrow,
            status: EscrowStatus.REFUNDED,
            refunded_at: new Date().toISOString(),
          },
          error: null,
        });

      const result = await service.resolveEscrow('escrow-1', 'payer-1', {
        action: 'refund',
      });

      expect(result.status).toBe(EscrowStatus.REFUNDED);
    });

    it('should allow payee to also trigger refund', async () => {
      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: heldEscrow, error: null })
        .mockResolvedValueOnce({
          data: { coins_balance: 200 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            ...heldEscrow,
            status: EscrowStatus.REFUNDED,
            refunded_at: new Date().toISOString(),
          },
          error: null,
        });

      const result = await service.resolveEscrow('escrow-1', 'payee-1', {
        action: 'refund',
      });

      expect(result.status).toBe(EscrowStatus.REFUNDED);
    });

    it('should cancel escrow when payer requests cancel', async () => {
      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: heldEscrow, error: null })
        .mockResolvedValueOnce({
          data: { coins_balance: 200 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            ...heldEscrow,
            status: EscrowStatus.CANCELLED,
            cancelled_at: new Date().toISOString(),
          },
          error: null,
        });

      const result = await service.resolveEscrow('escrow-1', 'payer-1', {
        action: 'cancel',
      });

      expect(result.status).toBe(EscrowStatus.CANCELLED);
    });

    it('should throw NotFoundException for non-existent escrow', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'not found' },
      });

      await expect(
        service.resolveEscrow('nonexistent', 'payer-1', {
          action: 'refund',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when escrow is already resolved', async () => {
      const releasedEscrow = { ...heldEscrow, status: EscrowStatus.RELEASED };
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: releasedEscrow,
        error: null,
      });

      await expect(
        service.resolveEscrow('escrow-1', 'payee-1', {
          action: 'release',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when non-payer tries to cancel', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: heldEscrow,
        error: null,
      });

      await expect(
        service.resolveEscrow('escrow-1', 'other-user', {
          action: 'cancel',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when non-payee tries to release', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: heldEscrow,
        error: null,
      });

      await expect(
        service.resolveEscrow('escrow-1', 'other-user', {
          action: 'release',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getEscrowById', () => {
    const escrowRow = {
      id: 'escrow-1',
      payer_id: 'payer-1',
      payee_id: 'payee-1',
      amount_coins: 100,
      status: EscrowStatus.HELD,
      reference_type: 'session',
      reference_id: 'session-1',
      held_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      released_at: null,
      refunded_at: null,
      cancelled_at: null,
      dispute_reason: null,
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it('should return escrow from cache when available', async () => {
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(escrowRow));

      const result = await service.getEscrowById('escrow-1');
      expect(result).toEqual(escrowRow);
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('should fall back to database and cache on cache miss', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: escrowRow,
        error: null,
      });

      const result = await service.getEscrowById('escrow-1');
      expect(result).toEqual(escrowRow);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'escrow:detail:escrow-1',
        expect.any(String),
        'EX',
        300,
      );
    });

    it('should throw NotFoundException when escrow does not exist', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'not found' },
      });

      await expect(service.getEscrowById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listEscrows', () => {
    const escrowRow = {
      id: 'escrow-1',
      payer_id: 'payer-1',
      payee_id: 'payee-1',
      amount_coins: 100,
      status: EscrowStatus.HELD,
      reference_type: 'session',
      reference_id: 'session-1',
      held_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      released_at: null,
      refunded_at: null,
      cancelled_at: null,
      dispute_reason: null,
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it('should return cached list when available', async () => {
      const cached = { payments: [escrowRow], total: 1, page: 1, pageSize: 20 };
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cached));

      const result = await service.listEscrows('payer-1', {});
      expect(result).toEqual(cached);
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('should query database and cache on cache miss', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const rangeMock = {
        data: [escrowRow],
        error: null,
        count: 1,
      };
      const rangeBuilder = {
        ...mockQueryBuilder,
        range: jest.fn().mockResolvedValue(rangeMock),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        count: undefined,
      };

      const mockFrom = jest.fn().mockImplementation(() => rangeBuilder);
      mockSupabaseClient.from = mockFrom;

      const result = await service.listEscrows('payer-1', {});
      expect(result.payments).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockRedisClient.set).toHaveBeenCalled();
    });

    it('should filter by status when provided', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const releasedEscrow = { ...escrowRow, status: EscrowStatus.RELEASED };
      const rangeBuilder = {
        ...mockQueryBuilder,
        range: jest.fn().mockResolvedValue({
          data: [releasedEscrow],
          error: null,
          count: 1,
        }),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        count: undefined,
      };

      mockSupabaseClient.from = jest.fn().mockReturnValue(rangeBuilder);

      const result = await service.listEscrows('payer-1', {
        status: 'released',
      });
      expect(result.payments).toHaveLength(1);
      expect(result.payments[0].status).toBe(EscrowStatus.RELEASED);
    });
  });
});

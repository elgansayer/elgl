import { Test, TestingModule } from '@nestjs/testing';
<<<<<<< HEAD
=======
import { ConfigService } from '@nestjs/config';
>>>>>>> origin/main
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CrashReportService } from './crash-report.service';
import { EscrowService } from './escrow.service';
<<<<<<< HEAD
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
=======
import { CircuitBreakerService } from './circuit-breaker.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateEscrowHoldDto } from './dto/escrow.dto';

// Mock the sanitise helper to avoid ESM import issues with jsdom/dompurify
jest.mock('./sanitise-escrow.helper', () => ({
  sanitiseEscrowData: <T>(value: T): T => value,
}));

describe('EscrowService', () => {
  let service: EscrowService;
  let mockSupabaseClient: Record<string, jest.Mock>;
  let mockRedisClient: Record<string, jest.Mock>;
  let cbService: CircuitBreakerService;

  const mockUserId = '12345678-1234-1234-1234-123456789012';
  const mockPayeeId = '87654321-4321-4321-4321-210987654321';
  const mockTransactionId = '99999999-9999-9999-9999-999999999999';

  beforeEach(async () => {
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockReturnThis(),
>>>>>>> origin/main
    };

    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
<<<<<<< HEAD
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([]),
=======
      lpush: jest.fn().mockResolvedValue(1),
      lrange: jest.fn().mockResolvedValue([]),
      ltrim: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    const mockSupabaseService = {
      getClient: jest.fn().mockReturnValue(mockSupabaseClient),
      getRedisClient: jest.fn().mockReturnValue(mockRedisClient),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'FRONTEND_URL') return 'http://localhost:4200';
        return undefined;
      }),
>>>>>>> origin/main
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
<<<<<<< HEAD
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
            getRedisClient: jest.fn().mockReturnValue(mockRedisClient),
          },
        },
=======
        CircuitBreakerService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: ConfigService, useValue: mockConfigService },
>>>>>>> origin/main
      ],
    }).compile();

    service = module.get<EscrowService>(EscrowService);
<<<<<<< HEAD
  });

  afterEach(() => {
    jest.clearAllMocks();
=======
    cbService = module.get<CircuitBreakerService>(CircuitBreakerService);
    // Reset circuit breaker before EVERY test to prevent cross-test contamination
    service.resetCircuitBreaker();
    cbService.reset('escrow');
>>>>>>> origin/main
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

<<<<<<< HEAD
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
=======
  describe('holdCoins', () => {
    const dto: CreateEscrowHoldDto = {
      payee_id: mockPayeeId,
      amount_coins: 50,
      reason: 'Test escrow',
      metadata: { lessonId: 'abc' },
    };

    beforeEach(() => {
      // Reset circuit breaker before each test to prevent cross-test contamination
      service.resetCircuitBreaker();
    });

    it('should hold coins successfully', async () => {
      // Only two .single() calls: payer balance check and escrow insert
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: { coins_balance: 100 }, error: null }) // payer balance
        .mockResolvedValueOnce({
          // insert escrow transaction
          data: {
            id: mockTransactionId,
            payer_id: mockUserId,
            payee_id: mockPayeeId,
            amount_coins: 50,
            status: 'held',
            reason: 'Test escrow',
            metadata: { lessonId: 'abc' },
            held_at: new Date().toISOString(),
            released_at: null,
            refunded_at: null,
            cancelled_at: null,
            retry_count: 0,
            last_error: null,
            next_retry_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        });

      const result = await service.holdCoins(mockUserId, dto);
      expect(result.success).toBe(true);
      expect(result.transaction_id).toBe(mockTransactionId);
      expect(result.degraded).toBe(false);
    });

    it('should reject escrow to self', async () => {
      await expect(
        service.holdCoins(mockUserId, { ...dto, payee_id: mockUserId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should degrade gracefully when payer not found', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      const result = await service.holdCoins(mockUserId, dto);
      expect(result.success).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.fallback_reason).toContain('Payer not found');
    });

    it('should degrade gracefully when insufficient balance', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { coins_balance: 10 },
        error: null,
      });

      const result = await service.holdCoins(mockUserId, dto);
      expect(result.success).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.fallback_reason).toContain('Insufficient balance');
    });

    it('should enter degraded mode when circuit is open', async () => {
      const cbService = (
        service as unknown as { circuitBreaker: CircuitBreakerService }
      ).circuitBreaker;

      for (let i = 0; i < 5; i++) {
        cbService.recordFailure('escrow');
      }

      const result = await service.holdCoins(mockUserId, dto);
      expect(result.success).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.fallback_reason).toContain('Circuit breaker open');
    });
  });

  describe('releaseCoins', () => {
    const tx = {
      id: mockTransactionId,
      payer_id: mockUserId,
      payee_id: mockPayeeId,
      amount_coins: 50,
      status: 'held',
      reason: 'Test escrow',
      metadata: {},
      held_at: new Date().toISOString(),
      released_at: null,
      refunded_at: null,
      cancelled_at: null,
      retry_count: 0,
      last_error: null,
      next_retry_at: null,
>>>>>>> origin/main
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

<<<<<<< HEAD
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
=======
    beforeEach(() => {
      service.resetCircuitBreaker();
    });

    it('should release coins successfully', async () => {
      // 3 single() calls: get tx, get payee balance, update escrow to released
      // The payee credit update does NOT call .single()
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: tx, error: null }) // 1: get transaction
        .mockResolvedValueOnce({ data: { coins_balance: 30 }, error: null }) // 2: payee balance
        .mockResolvedValueOnce({
          // 3: update escrow to released
          data: {
            ...tx,
            status: 'released',
            released_at: new Date().toISOString(),
          },
          error: null,
        });

      const result = await service.releaseCoins(mockTransactionId, mockUserId);
      expect(result.success).toBe(true);
      expect(result.transaction_id).toBe(mockTransactionId);
      expect(result.degraded).toBe(false);
    });

    it('should degrade gracefully when transaction not found', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      const result = await service.releaseCoins('non-existent', mockUserId);
      expect(result.success).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.fallback_reason).toContain('Escrow transaction not found');
    });

    it('should degrade gracefully when status is not held', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { ...tx, status: 'released' },
        error: null,
      });

      const result = await service.releaseCoins(mockTransactionId, mockUserId);
      expect(result.success).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.fallback_reason).toContain('Cannot release');
    });

    it('should degrade gracefully when not the payer', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: tx,
        error: null,
      });

      const result = await service.releaseCoins(mockTransactionId, mockPayeeId);
      expect(result.success).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.fallback_reason).toContain('Only the payer');
    });
  });

  describe('refundCoins', () => {
    const tx = {
      id: mockTransactionId,
      payer_id: mockUserId,
      payee_id: mockPayeeId,
      amount_coins: 50,
      status: 'held',
      reason: 'Test escrow',
      metadata: {},
      held_at: new Date().toISOString(),
      released_at: null,
      refunded_at: null,
      cancelled_at: null,
      retry_count: 0,
      last_error: null,
      next_retry_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    beforeEach(() => {
      service.resetCircuitBreaker();
    });

    it('should refund coins successfully', async () => {
      // 3 single() calls: get tx, get payer balance, update escrow to refunded
      // The payer credit update does NOT call .single()
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: tx, error: null }) // get transaction
        .mockResolvedValueOnce({ data: { coins_balance: 50 }, error: null }) // payer balance
        .mockResolvedValueOnce({
          // update escrow to refunded
          data: {
            ...tx,
            status: 'refunded',
>>>>>>> origin/main
            refunded_at: new Date().toISOString(),
          },
          error: null,
        });

<<<<<<< HEAD
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
=======
      const result = await service.refundCoins(mockTransactionId, mockUserId);
      expect(result.status).toBe('refunded');
      expect(result.degraded).toBe(false);
    });

    it('should degrade gracefully when not the payer', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: tx,
        error: null,
      });

      const result = await service.refundCoins(mockTransactionId, mockPayeeId);
      expect(result.degraded).toBe(true);
      expect(result.fallback_reason).toContain('Only the payer');
    });
  });

  describe('cancelEscrow', () => {
    const tx = {
      id: mockTransactionId,
      payer_id: mockUserId,
      payee_id: mockPayeeId,
      amount_coins: 50,
      status: 'held',
      reason: 'Test escrow',
      metadata: {},
      held_at: new Date().toISOString(),
      released_at: null,
      refunded_at: null,
      cancelled_at: null,
      retry_count: 0,
      last_error: null,
      next_retry_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it('should cancel successfully (payer)', async () => {
      // 3 single() calls: get tx, get payer balance, update escrow to cancelled
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: tx, error: null }) // get transaction
        .mockResolvedValueOnce({ data: { coins_balance: 50 }, error: null }) // payer balance
        .mockResolvedValueOnce({
          data: {
            ...tx,
            status: 'cancelled',
>>>>>>> origin/main
            cancelled_at: new Date().toISOString(),
          },
          error: null,
        });

<<<<<<< HEAD
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
=======
      const result = await service.cancelEscrow(mockTransactionId, mockUserId);
      expect(result.status).toBe('cancelled');
    });

    it('should cancel successfully (payee)', async () => {
      // 3 single() calls: get tx, get payer balance, update escrow to cancelled
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: tx, error: null }) // get transaction
        .mockResolvedValueOnce({ data: { coins_balance: 50 }, error: null }) // payer balance
        .mockResolvedValueOnce({
          data: {
            ...tx,
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
          },
          error: null,
        });

      const result = await service.cancelEscrow(mockTransactionId, mockPayeeId);
      expect(result.status).toBe('cancelled');
    });

    it('should throw when not authorised', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: tx,
        error: null,
      });

      await expect(
        service.cancelEscrow(
          mockTransactionId,
          '00000000-0000-0000-0000-000000000000',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when already released', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { ...tx, status: 'released' },
        error: null,
      });

      await expect(
        service.cancelEscrow(mockTransactionId, mockUserId),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getTransaction', () => {
    const tx = {
      id: mockTransactionId,
      payer_id: mockUserId,
      payee_id: mockPayeeId,
      amount_coins: 50,
      status: 'held',
      reason: 'Test escrow',
      metadata: {},
      held_at: new Date().toISOString(),
      released_at: null,
      refunded_at: null,
      cancelled_at: null,
      retry_count: 0,
      last_error: null,
      next_retry_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it('should return transaction for the payer', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: tx,
        error: null,
      });

      const result = await service.getTransaction(
        mockTransactionId,
        mockUserId,
      );
      expect(result.id).toBe(mockTransactionId);
      expect(result.payer_id).toBe(mockUserId);
    });

    it('should return transaction for the payee', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: tx,
        error: null,
      });

      const result = await service.getTransaction(
        mockTransactionId,
        mockPayeeId,
      );
      expect(result.id).toBe(mockTransactionId);
    });

    it('should throw when not authorised', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: tx,
        error: null,
      });

      await expect(
        service.getTransaction(
          mockTransactionId,
          '00000000-0000-0000-0000-000000000000',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when not found', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });
      // Redis fallback returns empty array
      mockRedisClient.lrange.mockResolvedValue([]);

      await expect(
        service.getTransaction('non-existent', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should find transaction in degraded queue as fallback', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });
      mockRedisClient.lrange.mockResolvedValue([JSON.stringify(tx)]);

      const result = await service.getTransaction(
        mockTransactionId,
        mockUserId,
      );
      expect(result.id).toBe(mockTransactionId);
      expect(result.degraded).toBe(true);
    });
  });

  describe('listTransactions', () => {
    it('should return empty array on error', async () => {
      mockSupabaseClient.range.mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      });

      const result = await service.listTransactions(mockUserId);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should return transactions for the user', async () => {
      const tx = {
        id: mockTransactionId,
        payer_id: mockUserId,
        payee_id: mockPayeeId,
        amount_coins: 50,
        status: 'held',
        reason: 'Test',
        metadata: {},
        held_at: new Date().toISOString(),
        released_at: null,
        refunded_at: null,
        cancelled_at: null,
        retry_count: 0,
        last_error: null,
        next_retry_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSupabaseClient.range.mockResolvedValue({
        data: [tx],
        error: null,
      });

      const result = await service.listTransactions(mockUserId);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(mockTransactionId);
    });
  });

  describe('processDegradedQueue', () => {
    it('should process degraded queue items', async () => {
      mockRedisClient.lrange.mockResolvedValue([
        JSON.stringify({
          id: 'degraded_1_abc',
          payer_id: mockUserId,
          payee_id: mockPayeeId,
          amount_coins: 30,
          status: 'pending',
          reason: 'Degraded hold',
          metadata: {},
          degraded: true,
          created_at: new Date().toISOString(),
        }),
      ]);

      // Setup successful hold: 2 single() calls for balance and insert
      mockSupabaseClient.single.mockResolvedValue({
        data: { coins_balance: 100 },
        error: null,
      });

      const result = await service.processDegradedQueue();
      // The retryWithBackoff should work on the retry - either processed or failed
      expect(result).toBeDefined();
      expect(typeof result.processed).toBe('number');
      expect(typeof result.failed).toBe('number');
    }, 15000);

    it('should handle empty queue', async () => {
      mockRedisClient.lrange.mockResolvedValue([]);
      const result = await service.processDegradedQueue();
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.lrange.mockRejectedValue(
        new Error('Redis connection lost'),
      );
      const result = await service.processDegradedQueue();
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should count corrupt JSON items as failures', async () => {
      mockRedisClient.lrange.mockResolvedValue(['not-valid-json']);
      const result = await service.processDegradedQueue();
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);
    });

    it('should skip items missing payer_id without counting as failures', async () => {
      mockRedisClient.lrange.mockResolvedValue([
        JSON.stringify({
          id: 'degraded_2',
          payer_id: null,
          payee_id: mockPayeeId,
          amount_coins: 30,
          status: 'pending',
          reason: 'No payer',
          metadata: {},
        }),
      ]);
      const result = await service.processDegradedQueue();
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('holdCoins edge cases', () => {
    it('should rollback deduction when escrow insert fails', async () => {
      const dto = {
        payee_id: mockPayeeId,
        amount_coins: 50,
        reason: 'Test escrow',
      };

      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: { coins_balance: 100 }, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

      const result = await service.holdCoins(mockUserId, dto);
      expect(result.degraded).toBe(true);
    }, 15000);

    it('should handle deduction failure gracefully', async () => {
      const dto = {
        payee_id: mockPayeeId,
        amount_coins: 50,
        reason: 'Test escrow',
      };

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { coins_balance: 100 },
        error: null,
      });
      // The deduction update should fail
      mockSupabaseClient.update = jest.fn().mockReturnValue({
        eq: jest
          .fn()
          .mockResolvedValue({ error: { message: 'Update failed' } }),
      });

      const result = await service.holdCoins(mockUserId, dto);
      expect(result.degraded).toBe(true);
    }, 15000);
  });

  describe('releaseCoins edge cases', () => {
    const tx = {
      id: mockTransactionId,
      payer_id: mockUserId,
      payee_id: mockPayeeId,
      amount_coins: 50,
      status: 'held',
      reason: 'Test escrow',
      metadata: {},
      held_at: new Date().toISOString(),
      released_at: null,
      refunded_at: null,
      cancelled_at: null,
      retry_count: 0,
      last_error: null,
      next_retry_at: null,
>>>>>>> origin/main
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

<<<<<<< HEAD
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
=======
    it('should degrade when payee not found on release', async () => {
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: tx, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

      const result = await service.releaseCoins(mockTransactionId, mockUserId);
      expect(result.degraded).toBe(true);
    }, 15000);

    it('should degrade when credit to payee fails', async () => {
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: tx, error: null })
        .mockResolvedValueOnce({ data: { coins_balance: 30 }, error: null });

      mockSupabaseClient.update = jest.fn().mockReturnValue({
        eq: jest
          .fn()
          .mockResolvedValue({ error: { message: 'Credit failed' } }),
      });

      const result = await service.releaseCoins(mockTransactionId, mockUserId);
      expect(result.degraded).toBe(true);
    }, 15000);
  });

  describe('refundCoins edge cases', () => {
    const tx = {
      id: mockTransactionId,
      payer_id: mockUserId,
      payee_id: mockPayeeId,
      amount_coins: 50,
      status: 'held',
      reason: 'Test escrow',
      metadata: {},
      held_at: new Date().toISOString(),
      released_at: null,
      refunded_at: null,
      cancelled_at: null,
      retry_count: 0,
      last_error: null,
      next_retry_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it('should degrade when payer not found on refund', async () => {
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: tx, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      const result = await service.refundCoins(mockTransactionId, mockUserId);
      expect(result.degraded).toBe(true);
    }, 15000);

    it('should degrade when status is already released', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { ...tx, status: 'released' },
        error: null,
      });

      const result = await service.refundCoins(mockTransactionId, mockUserId);
      expect(result.degraded).toBe(true);
    }, 15000);
  });

  describe('cancelEscrow edge cases', () => {
    const tx = {
      id: mockTransactionId,
      payer_id: mockUserId,
      payee_id: mockPayeeId,
      amount_coins: 50,
      status: 'held',
      reason: 'Test escrow',
      metadata: {},
      held_at: new Date().toISOString(),
      released_at: null,
      refunded_at: null,
      cancelled_at: null,
      retry_count: 0,
      last_error: null,
      next_retry_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it('should handle null payer balance on cancel of held escrow', async () => {
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: tx, error: null }) // get tx
        .mockResolvedValueOnce({ data: null, error: null }) // payer balance is null
        .mockResolvedValueOnce({
          data: {
            ...tx,
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
          },
          error: null,
        }); // update to cancelled

      const result = await service.cancelEscrow(mockTransactionId, mockUserId);
      expect(result.status).toBe('cancelled');
    });

    it('should throw when escrow not found on cancel', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      await expect(
        service.cancelEscrow('non-existent', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listTransactions edge cases', () => {
    it('should filter transactions by status', async () => {
      const tx = {
        id: mockTransactionId,
        payer_id: mockUserId,
        payee_id: mockPayeeId,
        amount_coins: 50,
        status: 'released',
        reason: 'Test',
        metadata: {},
        held_at: new Date().toISOString(),
        released_at: new Date().toISOString(),
        refunded_at: null,
        cancelled_at: null,
        retry_count: 0,
        last_error: null,
        next_retry_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const eqMock = jest.fn().mockResolvedValue({ data: [tx], error: null });
      mockSupabaseClient.range.mockReturnValue({ eq: eqMock });

      const result = await service.listTransactions(
        mockUserId,
        'released',
        20,
        0,
      );
      expect(result.length).toBe(1);
      expect(result[0].status).toBe('released');
      expect(eqMock).toHaveBeenCalledWith('status', 'released');
    });

    it('should handle large offset value', async () => {
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await service.listTransactions(
        mockUserId,
        undefined,
        10,
        100,
      );
      expect(result).toEqual([]);
    });
  });

  describe('getCircuitBreakerStatus', () => {
    it('should return circuit breaker state', () => {
      const status = service.getCircuitBreakerStatus();
      expect(status.service).toBe('escrow');
      expect(status.isOpen).toBe(false);
      expect(status.failureCount).toBe(0);
    });

    it('should reflect opened circuit', () => {
      const cbService = (
        service as unknown as { circuitBreaker: CircuitBreakerService }
      ).circuitBreaker;

      for (let i = 0; i < 5; i++) {
        cbService.recordFailure('escrow');
      }

      const status = service.getCircuitBreakerStatus();
      expect(status.isOpen).toBe(true);
    });
  });

  describe('resetCircuitBreaker', () => {
    it('should reset the circuit breaker', () => {
      const cbService = (
        service as unknown as { circuitBreaker: CircuitBreakerService }
      ).circuitBreaker;

      for (let i = 0; i < 5; i++) {
        cbService.recordFailure('escrow');
      }

      service.resetCircuitBreaker();
      const status = service.getCircuitBreakerStatus();
      expect(status.isOpen).toBe(false);
>>>>>>> origin/main
    });
  });
});

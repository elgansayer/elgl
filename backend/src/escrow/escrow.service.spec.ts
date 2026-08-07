import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
<<<<<<< HEAD
<<<<<<< HEAD
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EscrowService } from './escrow.service';
import { SupabaseService } from '../supabase/supabase.service';
import { GdprDataScrubbingService } from './gdpr-data-scrubbing.service';

describe('EscrowService', () => {
  let service: EscrowService;

  const makeQueryChain = (
    finalResult: unknown,
  ): Record<string, jest.Mock> & { data: unknown; error: unknown } => {
    const result = finalResult as { data?: unknown; error?: unknown } | null;
    const chain: Record<string, jest.Mock> & { data: unknown; error: unknown } =
      {
        data: result?.data ?? null,
        error: result?.error ?? null,
      } as unknown as Record<string, jest.Mock> & {
        data: unknown;
        error: unknown;
      };

    const methods = [
      'select',
      'insert',
      'update',
      'delete',
      'eq',
      'or',
      'lte',
      'in',
      'order',
      'single',
      'maybeSingle',
    ];
    for (const method of methods) {
      chain[method] = jest.fn().mockReturnValue(chain);
    }
    chain.single.mockResolvedValue(finalResult);
    chain.maybeSingle.mockResolvedValue(finalResult);
    chain.order.mockReturnValue(chain);
    chain.select.mockReturnValue(chain);
    chain.insert.mockReturnValue(chain);
    chain.update.mockReturnValue(chain);
    chain.delete.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.or.mockReturnValue(chain);
    chain.lte.mockReturnValue(chain);
    chain.in.mockReturnValue(chain);
    return chain;
  };

  const mockGdprScrubbing = {
    scrubFreeText: jest.fn((text: string) => text),
    detectPii: jest.fn(() => ({ hasPii: false, piiFields: [] })),
    scrubTransactionData: jest.fn((data: Record<string, unknown>) => ({
      scrubbed: {
        ...data,
        is_data_scrubbed: true,
        gdpr_scrubbed_at: new Date().toISOString(),
        transaction_subject: '[REDACTED]',
        description: '[REDACTED]',
        reason: '[REDACTED]',
        evidence_description: '[REDACTED]',
        release_note: '[REDACTED]',
      },
      result: {
        transaction_id: data['id'] as string,
        scrubbed_fields: [
          'transaction_subject',
          'description',
          'release_note',
          'reason',
          'evidence_description',
          'resolution_note',
        ],
        performed_at: new Date().toISOString(),
      },
    })),
    calculateRetentionDate: jest.fn(() => {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 7);
      return d;
    }),
    logScrubbingEvent: jest.fn(),
  };

  const mockTransaction = {
    id: 'escrow-1',
    sender_id: 'user-sender',
    recipient_id: 'user-recipient',
    transaction_subject: 'Test transaction',
    description: 'Test description',
    amount_cents: 10000,
    currency: 'usd',
    status: 'pending',
    total_milestones: 2,
    released_milestones: 0,
    is_data_scrubbed: false,
    gdpr_retention_date: new Date(
      Date.now() + 1000 * 60 * 60 * 24 * 365 * 7,
    ).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let mockFrom: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockFrom = jest.fn();

    const mockSupabaseClient = {
      from: mockFrom,
=======
  NotFoundException,
  ForbiddenException,
=======
>>>>>>> origin/main
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateEscrowHoldDto } from './dto/escrow.dto';

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
    };

<<<<<<< HEAD
    const mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
>>>>>>> origin/main
=======
    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
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
<<<<<<< HEAD
          useValue: { getClient: () => mockSupabaseClient },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: GdprDataScrubbingService,
          useValue: mockGdprScrubbing,
=======
          useValue: { getClient: jest.fn().mockReturnValue(mockSupabaseClient) },
        },
        {
          provide: MonetisationService,
          useValue: {
            deductCoins: jest.fn(),
            addCoins: jest.fn(),
          },
>>>>>>> origin/main
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
<<<<<<< HEAD
=======
    monetisationService = module.get<MonetisationService>(MonetisationService);

    jest.clearAllMocks();
>>>>>>> origin/main
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
<<<<<<< HEAD
    it('should throw if sender is recipient', async () => {
      await expect(
        service.createEscrow('user-1', {
          transaction_subject: 'Test',
          amount_cents: 1000,
          currency: 'usd',
          recipient_id: 'user-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create escrow transaction with milestones', async () => {
      const escrowChain = makeQueryChain({
        data: mockTransaction,
        error: null,
      });
      const milestoneChain = makeQueryChain({
        data: null,
        error: null,
      });

      mockFrom
        .mockReturnValueOnce(escrowChain)
        .mockReturnValueOnce(milestoneChain);

      const result = await service.createEscrow('user-sender', {
        transaction_subject: 'Test escrow',
        amount_cents: 10000,
        currency: 'usd',
        recipient_id: 'user-recipient',
        milestone_count: 2,
      });

      expect(result).toBeDefined();
      expect(mockFrom).toHaveBeenCalledWith('escrow_transactions');
=======
    const payerId = 'payer-1';
    const dto = { payee_id: 'payee-1', amount_coins: 100 };
=======
  describe('holdCoins', () => {
    const dto: CreateEscrowHoldDto = {
      payee_id: mockPayeeId,
      amount_coins: 50,
      reason: 'Test escrow',
      metadata: { lessonId: 'abc' },
    };
>>>>>>> origin/main

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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

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
            refunded_at: new Date().toISOString(),
          },
          error: null,
        });

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
            cancelled_at: new Date().toISOString(),
          },
          error: null,
        });

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

<<<<<<< HEAD
    it('should refund escrow successfully', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: heldEscrow, error: null });
      (monetisationService.addCoins as jest.Mock).mockResolvedValue(150);

      const result = await service.refundEscrow(userId, escrowId);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        status: 'refunded',
        refunded_at: expect.any(String) as string,
        updated_at: expect.any(String) as string,
      });
      expect(result).toEqual({
        id: escrowId,
        status: 'refunded',
        amount_coins: 100,
        payer_balance: 150,
      });
>>>>>>> origin/main
    });
  });

  describe('getEscrow', () => {
<<<<<<< HEAD
    it('should return escrow for sender', async () => {
      const chain = makeQueryChain({ data: mockTransaction, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await service.getEscrow('user-sender', 'escrow-1');
      expect(result).toBeDefined();
      expect(result.id).toBe('escrow-1');
    });

    it('should return escrow for recipient', async () => {
      const chain = makeQueryChain({ data: mockTransaction, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await service.getEscrow('user-recipient', 'escrow-1');
      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException for non-party user', async () => {
      const chain = makeQueryChain({ data: mockTransaction, error: null });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.getEscrow('user-stranger', 'escrow-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for missing transaction', async () => {
      const chain = makeQueryChain({
        data: null,
        error: { message: 'Not found' },
      });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.getEscrow('user-sender', 'escrow-nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return scrubbed data for scrubbed transactions', async () => {
      const scrubbedTx = { ...mockTransaction, is_data_scrubbed: true };
      const chain = makeQueryChain({ data: scrubbedTx, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await service.getEscrow('user-sender', 'escrow-1');
      expect(mockGdprScrubbing.scrubTransactionData).toHaveBeenCalled();
      expect(result.is_data_scrubbed).toBe(true);
    });
  });

  describe('releaseMilestone', () => {
    it('should throw ForbiddenException if not sender', async () => {
      const chain = makeQueryChain({ data: mockTransaction, error: null });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.releaseMilestone('user-recipient', {
          escrow_id: 'escrow-1',
          milestone_id: 'mile-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException for disputed transaction', async () => {
      const disputedTx = { ...mockTransaction, status: 'disputed' };
      const chain = makeQueryChain({ data: disputedTx, error: null });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.releaseMilestone('user-sender', {
          escrow_id: 'escrow-1',
          milestone_id: 'mile-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw if transaction is scrubbed', async () => {
      const chain = makeQueryChain({
        data: { ...mockTransaction, is_data_scrubbed: true },
        error: null,
      });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.releaseMilestone('user-sender', {
          escrow_id: 'escrow-1',
          milestone_id: 'mile-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('disputeEscrow', () => {
    it('should throw ForbiddenException for non-party user', async () => {
      const chain = makeQueryChain({ data: mockTransaction, error: null });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.disputeEscrow('user-stranger', {
          escrow_id: 'escrow-1',
          reason: 'Issue',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create dispute for sender', async () => {
      const getEscrowChain = makeQueryChain({
        data: mockTransaction,
        error: null,
      });
      const existingDisputeChain = makeQueryChain({
        data: null,
        error: null,
      });
      const createDisputeChain = makeQueryChain({
        data: {
          id: 'dispute-1',
          escrow_id: 'escrow-1',
          raised_by: 'user-sender',
          reason: 'Not satisfied',
          status: 'open',
        },
        error: null,
      });
      const updateTxChain = makeQueryChain({ data: null, error: null });

      mockFrom
        .mockReturnValueOnce(getEscrowChain)
        .mockReturnValueOnce(existingDisputeChain)
        .mockReturnValueOnce(createDisputeChain)
        .mockReturnValueOnce(updateTxChain);

      const result = await service.disputeEscrow('user-sender', {
        escrow_id: 'escrow-1',
        reason: 'Not satisfied with the work',
      });

      expect(result.status).toBe('open');
    });
  });

  describe('scrubExpiredData', () => {
    it('should scrub expired transactions', async () => {
      const expiredTx = { ...mockTransaction, status: 'completed' };
      const selectChain = makeQueryChain({
        data: [expiredTx],
        error: null,
      });

      mockFrom.mockReturnValue(selectChain);

      const results = await service.scrubExpiredData();

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('requestDataDeletion', () => {
    it('should scrub all transactions for a user', async () => {
      const txChain = makeQueryChain({
        data: [mockTransaction],
        error: null,
      });
      const updateChain = makeQueryChain({ data: null, error: null });
      const emptyDisputesChain = makeQueryChain({
        data: [],
        error: null,
      });

      mockFrom
        .mockReturnValueOnce(txChain)
        .mockReturnValueOnce(updateChain)
        .mockReturnValueOnce(updateChain)
        .mockReturnValueOnce(emptyDisputesChain);

      const result = await service.requestDataDeletion('user-sender');

      expect(result.transactions_scrubbed).toBeGreaterThanOrEqual(0);
      expect(typeof result.disputes_anonymised).toBe('number');
    });
  });

  describe('getPiiReport', () => {
    it('should return PII report for a transaction', async () => {
      const txChain = makeQueryChain({
        data: {
          ...mockTransaction,
          transaction_subject: 'Payment for user@test.com',
        },
        error: null,
      });
      const disputesChain = makeQueryChain({
        data: [],
        error: null,
      });

      mockGdprScrubbing.detectPii.mockReturnValueOnce({
        hasPii: true,
        piiFields: ['EMAIL'],
      });

      mockFrom.mockReturnValueOnce(txChain).mockReturnValueOnce(disputesChain);

      const result = await service.getPiiReport('escrow-1');
      expect(result.hasPii).toBe(true);
      expect(result.details).toBeDefined();
    });

    it('should throw NotFoundException for missing transaction', async () => {
      const chain = makeQueryChain({ data: null, error: null });
      mockFrom.mockReturnValue(chain);

      await expect(service.getPiiReport('escrow-nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
=======
    const escrowId = 'escrow-1';
    const userId = 'payer-1';
=======
      const status = service.getCircuitBreakerStatus();
      expect(status.isOpen).toBe(true);
    });
  });

  describe('resetCircuitBreaker', () => {
    it('should reset the circuit breaker', () => {
      const cbService = (
        service as unknown as { circuitBreaker: CircuitBreakerService }
      ).circuitBreaker;
>>>>>>> origin/main

      for (let i = 0; i < 5; i++) {
        cbService.recordFailure('escrow');
      }

      service.resetCircuitBreaker();
      const status = service.getCircuitBreakerStatus();
      expect(status.isOpen).toBe(false);
    });
  });
<<<<<<< HEAD

  describe('listEscrows', () => {
    const userId = 'payer-1';

    it('should return escrow list with count', async () => {
      const escrowData = [
        { id: 'escrow-1', payer_id: userId, payee_id: 'payee-1', amount_coins: 50, status: 'held' },
      ];
      mockQueryBuilder.range.mockResolvedValue({ data: escrowData, error: null, count: 1 });

      const result = await service.listEscrows(userId);
      expect(result).toEqual({ escrows: escrowData, total: 1 });
    });

    it('should handle empty results', async () => {
      mockQueryBuilder.range.mockResolvedValue({ data: [], error: null, count: 0 });
      const result = await service.listEscrows(userId);
      expect(result).toEqual({ escrows: [], total: 0 });
    });
  });
});
>>>>>>> origin/main
=======
});
>>>>>>> origin/main

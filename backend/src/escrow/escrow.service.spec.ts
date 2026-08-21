import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CrashReportService } from './crash-report.service';
import { EscrowService } from './escrow.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from '../metrics/metrics.service';
import { CreateEscrowDto } from './dto/escrow.dto';

// Mock the sanitise helper to avoid ESM import issues with jsdom/dompurify
vi.mock('./sanitise-escrow.helper', () => ({
  sanitiseEscrowData: <T>(value: T): T => value,
}));

describe('EscrowService', () => {
  let service: EscrowService;
  let mockSupabaseClient: Record<string, Mock>;
  let mockRedisClient: Record<string, Mock>;
  let cbService: CircuitBreakerService;

  const mockUserId = '12345678-1234-1234-1234-123456789012';
  const mockPayeeId = '87654321-4321-4321-4321-210987654321';
  const mockTransactionId = '99999999-9999-9999-9999-999999999999';

  beforeEach(async () => {
    mockSupabaseClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
    };

    mockRedisClient = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      lpush: vi.fn().mockResolvedValue(1),
      lrange: vi.fn().mockResolvedValue([]),
      ltrim: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      scan: vi.fn().mockResolvedValue(['0', []]),
    };

    const mockSupabaseService = {
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
      getRedisClient: vi.fn().mockReturnValue(mockRedisClient),
    };

    const mockConfigService = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'FRONTEND_URL') return 'http://localhost:4200';
        return undefined;
      }),
    };

    const mockMetricsService = {
      recordEscrowCreated: vi.fn(),
      recordEscrowReleased: vi.fn(),
      recordEscrowRefunded: vi.fn(),
      recordEscrowCancelled: vi.fn(),
      recordEscrowAutoRefunded: vi.fn(),
      recordEscrowDegradedOperation: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        CircuitBreakerService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MetricsService, useValue: mockMetricsService },
        {
          provide: CrashReportService,
          useValue: {
            reportCrash: vi.fn().mockResolvedValue(null),
            listUnresolved: vi.fn().mockResolvedValue([]),
            acknowledgeReport: vi.fn().mockResolvedValue(true),
            resolveReport: vi.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<EscrowService>(EscrowService);
    cbService = module.get<CircuitBreakerService>(CircuitBreakerService);
    // Reset circuit breaker before EVERY test to prevent cross-test contamination
    service.resetCircuitBreaker();
    cbService.reset('escrow');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('holdCoins', () => {
    const dto: CreateEscrowDto = {
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
      mockSupabaseClient.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'Update failed' } }),
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

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

      mockSupabaseClient.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'Credit failed' } }),
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

      const eqMock = vi.fn().mockResolvedValue({ data: [tx], error: null });
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
    });
  });

  describe('Redis cache integration', () => {
    const tx = {
      id: mockTransactionId,
      payer_id: mockUserId,
      payee_id: mockPayeeId,
      amount_coins: 50,
      status: 'held' as const,
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

    describe('getTransaction caching', () => {
      it('should serve from Redis cache on hit', async () => {
        mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(tx));

        const result = await service.getTransaction(
          mockTransactionId,
          mockUserId,
        );

        expect(result.id).toBe(mockTransactionId);
        expect(result.payer_id).toBe(mockUserId);
        expect(mockSupabaseClient.single).not.toHaveBeenCalled();
      });

      it('should reject cached escrow when user is not a participant', async () => {
        const cached = {
          ...tx,
          payer_id: 'other-user',
          payee_id: 'other-payee',
        };
        mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cached));

        await expect(
          service.getTransaction(mockTransactionId, mockUserId),
        ).rejects.toThrow(BadRequestException);
      });

      it('should fall back to DB when cached escrow is invalid', async () => {
        mockRedisClient.get.mockResolvedValueOnce('not-json');
        mockSupabaseClient.single.mockResolvedValueOnce({
          data: tx,
          error: null,
        });

        const result = await service.getTransaction(
          mockTransactionId,
          mockUserId,
        );

        expect(result.id).toBe(mockTransactionId);
        expect(mockSupabaseClient.single).toHaveBeenCalled();
      });

      it('should cache escrow detail after a DB miss', async () => {
        mockRedisClient.get.mockResolvedValueOnce(null);
        mockSupabaseClient.single.mockResolvedValueOnce({
          data: tx,
          error: null,
        });

        await service.getTransaction(mockTransactionId, mockUserId);

        expect(mockRedisClient.set).toHaveBeenCalledWith(
          `escrow:detail:${mockTransactionId}`,
          JSON.stringify(tx),
          'EX',
          expect.any(Number) as number,
        );
      });
    });

    describe('listTransactions caching', () => {
      it('should return cached list when available', async () => {
        const cached = [
          {
            id: mockTransactionId,
            payer_id: mockUserId,
            payee_id: mockPayeeId,
            amount_coins: 50,
            status: 'held',
          },
        ];
        mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cached));

        const result = await service.listTransactions(mockUserId);

        expect(result).toEqual(cached);
        expect(mockSupabaseClient.range).not.toHaveBeenCalled();
      });

      it('should fall back to DB when list cache is invalid JSON', async () => {
        mockRedisClient.get.mockResolvedValueOnce('not-valid-json');
        mockSupabaseClient.range.mockResolvedValueOnce({
          data: [tx],
          error: null,
        });

        const result = await service.listTransactions(mockUserId);

        expect(result).toHaveLength(1);
        expect(mockSupabaseClient.range).toHaveBeenCalled();
      });

      it('should cache list result after a DB miss', async () => {
        mockRedisClient.get.mockResolvedValueOnce(null);
        mockSupabaseClient.range.mockResolvedValueOnce({
          data: [tx],
          error: null,
        });

        await service.listTransactions(mockUserId);

        expect(mockRedisClient.set).toHaveBeenCalledWith(
          expect.stringContaining(`escrow:user_list:${mockUserId}:l`),
          expect.any(String),
          'EX',
          expect.any(Number) as number,
        );
      });
    });

    describe('cache invalidation on mutations', () => {
      const cachedDetailKey = `escrow:detail:${mockTransactionId}`;

      it('should invalidate detail cache on holdCoins', async () => {
        mockSupabaseClient.single
          .mockResolvedValueOnce({ data: { coins_balance: 100 }, error: null })
          .mockResolvedValueOnce({
            data: tx,
            error: null,
          });

        mockRedisClient.scan.mockResolvedValue(['0', []]);

        await service.holdCoins(mockUserId, {
          payee_id: mockPayeeId,
          amount_coins: 50,
          reason: 'Test',
        });

        // Wait for background invalidation
        await new Promise((resolve) => setTimeout(resolve, 50));

        const delArgs = mockRedisClient.del.mock.calls.flat();
        expect(delArgs).toContain(cachedDetailKey);
      });

      it('should invalidate detail cache on releaseCoins', async () => {
        mockSupabaseClient.single
          .mockResolvedValueOnce({ data: tx, error: null })
          .mockResolvedValueOnce({ data: { coins_balance: 30 }, error: null })
          .mockResolvedValueOnce({
            data: {
              ...tx,
              status: 'released',
              payer_id: mockUserId,
              payee_id: mockPayeeId,
            },
            error: null,
          });

        mockRedisClient.scan.mockResolvedValue(['0', []]);

        await service.releaseCoins(mockTransactionId, mockUserId);

        await new Promise((resolve) => setTimeout(resolve, 50));

        const delArgs = mockRedisClient.del.mock.calls.flat();
        expect(delArgs).toContain(cachedDetailKey);
      });

      it('should invalidate detail cache on refundCoins', async () => {
        mockSupabaseClient.single
          .mockResolvedValueOnce({ data: tx, error: null })
          .mockResolvedValueOnce({ data: { coins_balance: 50 }, error: null })
          .mockResolvedValueOnce({
            data: {
              ...tx,
              status: 'refunded',
              payer_id: mockUserId,
              payee_id: mockPayeeId,
            },
            error: null,
          });

        mockRedisClient.scan.mockResolvedValue(['0', []]);

        await service.refundCoins(mockTransactionId, mockUserId);

        await new Promise((resolve) => setTimeout(resolve, 50));

        const delArgs = mockRedisClient.del.mock.calls.flat();
        expect(delArgs).toContain(cachedDetailKey);
      });

      it('should invalidate detail cache on cancelEscrow', async () => {
        mockSupabaseClient.single
          .mockResolvedValueOnce({ data: tx, error: null })
          .mockResolvedValueOnce({ data: { coins_balance: 50 }, error: null })
          .mockResolvedValueOnce({
            data: {
              ...tx,
              status: 'cancelled',
              payer_id: mockUserId,
              payee_id: mockPayeeId,
            },
            error: null,
          });

        mockRedisClient.scan.mockResolvedValue(['0', []]);

        await service.cancelEscrow(mockTransactionId, mockUserId);

        await new Promise((resolve) => setTimeout(resolve, 50));

        const delArgs = mockRedisClient.del.mock.calls.flat();
        expect(delArgs).toContain(cachedDetailKey);
      });

      it('should scan and delete user list caches on mutation', async () => {
        mockSupabaseClient.single
          .mockResolvedValueOnce({ data: tx, error: null })
          .mockResolvedValueOnce({ data: { coins_balance: 30 }, error: null })
          .mockResolvedValueOnce({
            data: {
              ...tx,
              status: 'released',
              payer_id: mockUserId,
              payee_id: mockPayeeId,
            },
            error: null,
          });

        mockRedisClient.scan
          .mockResolvedValueOnce([
            '0',
            [
              `escrow:user_list:${mockUserId}:l20:o0`,
              `escrow:user_list:${mockUserId}:l10:o0`,
            ],
          ])
          .mockResolvedValueOnce([
            '0',
            [`escrow:user_list:${mockPayeeId}:l20:o0`],
          ]);

        await service.releaseCoins(mockTransactionId, mockUserId);

        await new Promise((resolve) => setTimeout(resolve, 50));

        const allDelArgs = mockRedisClient.del.mock.calls.flat();
        expect(allDelArgs).toContain(cachedDetailKey);
        expect(allDelArgs).toContain(`escrow:user_list:${mockUserId}:l20:o0`);
        expect(allDelArgs).toContain(`escrow:user_list:${mockUserId}:l10:o0`);
        expect(allDelArgs).toContain(`escrow:user_list:${mockPayeeId}:l20:o0`);
      });
    });
  });
});

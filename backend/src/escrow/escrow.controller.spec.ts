import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';
import { EscrowExceptionFilter } from './escrow-exception.filter';
import { CrashReportService } from './crash-report.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseService } from '../supabase/supabase.service';

// Mock the sanitise helper to avoid ESM import issues with jsdom/dompurify
vi.mock('./sanitise-escrow.helper', () => ({
  sanitiseEscrowData: <T>(value: T): T => value,
}));

describe('EscrowController', () => {
  let controller: EscrowController;
  let mockEscrowService: Record<string, Mock>;

  const mockUserId = '12345678-1234-1234-1234-123456789012';
  const mockPayeeId = '87654321-4321-4321-4321-210987654321';
  const mockTransactionId = '99999999-9999-9999-9999-999999999999';

  const mockRequest = {
    user: { sub: mockUserId },
  };

  beforeEach(async () => {
    mockEscrowService = {
      holdCoins: vi.fn().mockResolvedValue({
        success: true,
        transaction_id: mockTransactionId,
        degraded: false,
      }),
      releaseCoins: vi.fn().mockResolvedValue({
        success: true,
        transaction_id: mockTransactionId,
        degraded: false,
      }),
      refundCoins: vi.fn().mockResolvedValue({
        id: mockTransactionId,
        status: 'refunded',
        degraded: false,
      }),
      cancelEscrow: vi.fn().mockResolvedValue({
        id: mockTransactionId,
        status: 'cancelled',
        degraded: false,
      }),
      disputeEscrow: vi.fn().mockResolvedValue({
        id: mockTransactionId,
        status: 'disputed',
        degraded: false,
      }),
      getTransaction: vi.fn().mockResolvedValue({
        id: mockTransactionId,
        payer_id: mockUserId,
        payee_id: mockPayeeId,
        amount_coins: 50,
        status: 'held',
        degraded: false,
      }),
      listTransactions: vi.fn().mockResolvedValue([]),
      getCircuitBreakerStatus: vi.fn().mockReturnValue({
        service: 'escrow',
        isOpen: false,
        failureCount: 0,
        cooldownUntil: 0,
        totalFailures: 0,
        totalSuccesses: 0,
      }),
      resetCircuitBreaker: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EscrowController],
      providers: [
        { provide: EscrowService, useValue: mockEscrowService },
        {
          provide: CrashReportService,
          useValue: {
            reportCrash: vi.fn(),
            listUnresolved: vi.fn().mockResolvedValue([]),
            acknowledgeReport: vi.fn().mockResolvedValue(true),
            resolveReport: vi.fn().mockResolvedValue(true),
          },
        },
        { provide: SupabaseService, useValue: {} },
        EscrowExceptionFilter,
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockResolvedValue(true) })
      .compile();

    controller = module.get<EscrowController>(EscrowController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('holdCoins', () => {
    it('should call service.holdCoins with correct params', async () => {
      const dto = { payee_id: mockPayeeId, amount_coins: 50, reason: 'Test' };
      const result = await controller.holdCoins(mockRequest, dto);
      expect(mockEscrowService.holdCoins).toHaveBeenCalledWith(mockUserId, dto);
      expect(result.success).toBe(true);
    });
  });

  describe('releaseCoins', () => {
    it('should call service.releaseCoins with correct params', async () => {
      const dto = { transaction_id: mockTransactionId };
      const result = await controller.releaseCoins(mockRequest, dto);
      expect(mockEscrowService.releaseCoins).toHaveBeenCalledWith(
        mockTransactionId,
        mockUserId,
      );
      expect(result.success).toBe(true);
    });
  });

  describe('refundCoins', () => {
    it('should call service.refundCoins with correct params', async () => {
      const dto = { transaction_id: mockTransactionId, reason: 'Changed mind' };
      const result = await controller.refundCoins(mockRequest, dto);
      expect(mockEscrowService.refundCoins).toHaveBeenCalledWith(
        mockTransactionId,
        mockUserId,
        'Changed mind',
      );
      expect(result.status).toBe('refunded');
    });
  });

  describe('cancelEscrow', () => {
    it('should call service.cancelEscrow with correct params', async () => {
      const dto = { transaction_id: mockTransactionId };
      const result = await controller.cancelEscrow(mockRequest, dto);
      expect(mockEscrowService.cancelEscrow).toHaveBeenCalledWith(
        mockTransactionId,
        mockUserId,
      );
      expect(result.status).toBe('cancelled');
    });
  });

  describe('disputeEscrow', () => {
    it('should call service.disputeEscrow with correct params', async () => {
      const dto = {
        transaction_id: mockTransactionId,
        reason: 'Service not delivered',
        evidence: 'Screenshots attached',
      };
      const result = await controller.disputeEscrow(mockRequest, dto);
      expect(mockEscrowService.disputeEscrow).toHaveBeenCalledWith(
        mockTransactionId,
        mockUserId,
        'Service not delivered',
        'Screenshots attached',
      );
      expect(result.status).toBe('disputed');
    });
  });

  describe('listTransactions', () => {
    it('should call service.listTransactions with defaults', async () => {
      await controller.listTransactions(
        mockRequest,
        undefined,
        undefined,
        undefined,
      );
      expect(mockEscrowService.listTransactions).toHaveBeenCalledWith(
        mockUserId,
        undefined,
        20,
        0,
      );
    });

    it('should parse limit and offset query params', async () => {
      await controller.listTransactions(mockRequest, 'held', '10', '5');
      expect(mockEscrowService.listTransactions).toHaveBeenCalledWith(
        mockUserId,
        'held',
        10,
        5,
      );
    });
  });

  describe('getTransaction', () => {
    it('should call service.getTransaction with correct params', async () => {
      const result = await controller.getTransaction(
        mockRequest,
        mockTransactionId,
      );
      expect(mockEscrowService.getTransaction).toHaveBeenCalledWith(
        mockTransactionId,
        mockUserId,
      );
      expect(result.id).toBe(mockTransactionId);
    });
  });

  describe('getCircuitBreakerStatus', () => {
    it('should return circuit breaker status', () => {
      const result = controller.getCircuitBreakerStatus();
      expect(mockEscrowService.getCircuitBreakerStatus).toHaveBeenCalled();
      expect(result.service).toBe('escrow');
    });
  });

  describe('resetCircuitBreaker', () => {
    it('should call reset on service', () => {
      const result = controller.resetCircuitBreaker();
      expect(mockEscrowService.resetCircuitBreaker).toHaveBeenCalled();
      expect(result.reset).toBe(true);
    });
  });

  describe('error propagation', () => {
    it('should propagate create errors from service', async () => {
      const error = new Error('Hold error');
      mockEscrowService.holdCoins.mockRejectedValue(error);
      await expect(
        controller.holdCoins(mockRequest, {
          payee_id: mockPayeeId,
          amount_coins: 50,
          reason: 'Test',
        }),
      ).rejects.toThrow('Hold error');
    });

    it('should propagate release errors from service', async () => {
      const error = new Error('Release error');
      mockEscrowService.releaseCoins.mockRejectedValue(error);
      await expect(
        controller.releaseCoins(mockRequest, {
          transaction_id: mockTransactionId,
        }),
      ).rejects.toThrow('Release error');
    });

    it('should propagate refund errors from service', async () => {
      const error = new Error('Refund error');
      mockEscrowService.refundCoins.mockRejectedValue(error);
      await expect(
        controller.refundCoins(mockRequest, {
          transaction_id: mockTransactionId,
        }),
      ).rejects.toThrow('Refund error');
    });

    it('should propagate getById errors from service', async () => {
      const error = new Error('Get error');
      mockEscrowService.getTransaction.mockRejectedValue(error);
      await expect(
        controller.getTransaction(mockRequest, mockTransactionId),
      ).rejects.toThrow('Get error');
    });

    it('should propagate list errors from service', async () => {
      const error = new Error('List error');
      mockEscrowService.listTransactions.mockRejectedValue(error);
      await expect(controller.listTransactions(mockRequest)).rejects.toThrow(
        'List error',
      );
    });
  });
});

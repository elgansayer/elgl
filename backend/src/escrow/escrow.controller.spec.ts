import { Test, TestingModule } from '@nestjs/testing';
import { EscrowController } from './escrow.controller';
import { EscrowExceptionFilter } from './escrow-exception.filter';
import { EscrowService } from './escrow.service';
import { CrashReportService } from './crash-report.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';

// Mock the sanitise helper to avoid ESM import issues with jsdom/dompurify
jest.mock('./sanitise-escrow.helper', () => ({
  sanitiseEscrowData: <T>(value: T): T => value,
}));

describe('EscrowController', () => {
  let controller: EscrowController;
  let mockEscrowService: Record<string, jest.Mock>;
  let mockCrashReportService: Record<string, jest.Mock>;

  const mockUserId = '12345678-1234-1234-1234-123456789012';
  const mockPayeeId = '87654321-4321-4321-4321-210987654321';
  const mockTransactionId = '99999999-9999-9999-9999-999999999999';

  const mockRequest = {
    user: { id: mockUserId },
  };

  beforeEach(async () => {
    mockEscrowService = {
      holdCoins: jest.fn().mockResolvedValue({
        success: true,
        transaction_id: mockTransactionId,
        degraded: false,
      }),
      releaseCoins: jest.fn().mockResolvedValue({
        success: true,
        transaction_id: mockTransactionId,
        degraded: false,
      }),
      refundCoins: jest.fn().mockResolvedValue({
        id: mockTransactionId,
        status: 'refunded',
        degraded: false,
      }),
      getTransaction: jest.fn().mockResolvedValue({
        id: mockTransactionId,
        payer_id: mockUserId,
        payee_id: mockPayeeId,
        amount_coins: 50,
        status: 'held',
        degraded: false,
      }),
      listTransactions: jest.fn().mockResolvedValue([]),
      getCircuitBreakerStatus: jest.fn().mockReturnValue({
        service: 'escrow',
        isOpen: false,
        failureCount: 0,
        cooldownUntil: 0,
        totalFailures: 0,
        totalSuccesses: 0,
      }),
      resetCircuitBreaker: jest.fn(),
    };

    mockCrashReportService = {
      reportCrash: jest.fn(),
      listUnresolved: jest.fn().mockResolvedValue([]),
      acknowledgeReport: jest.fn().mockResolvedValue(true),
      resolveReport: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EscrowController],
      providers: [
        {
          provide: EscrowService,
          useValue: mockEscrowService,
        },
        {
          provide: CrashReportService,
          useValue: mockCrashReportService,
        },
        EscrowExceptionFilter,
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn().mockResolvedValue(true) })
      .compile();

    controller = module.get<EscrowController>(EscrowController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create (holdCoins)', () => {
    it('should call service.holdCoins with correct params', async () => {
      const dto = {
        payee_id: mockPayeeId,
        amount_coins: 50,
        reason: 'Test',
      };

      const result = await controller.create(mockRequest, dto);
      expect(mockEscrowService.holdCoins).toHaveBeenCalledWith(mockUserId, dto);
      expect(result.success).toBe(true);
      expect(result.transaction_id).toBe(mockTransactionId);
    });
  });

  describe('release (releaseCoins)', () => {
    it('should call service.releaseCoins with correct params', async () => {
      const dto = { transaction_id: mockTransactionId };
      const result = await controller.release(mockRequest, dto);
      expect(mockEscrowService.releaseCoins).toHaveBeenCalledWith(
        mockTransactionId,
        mockUserId,
      );
      expect(result.success).toBe(true);
    });
  });

  describe('refund (refundCoins)', () => {
    it('should call service.refundCoins with correct params', async () => {
      const dto = { transaction_id: mockTransactionId, reason: 'Changed mind' };
      const result = await controller.refund(mockRequest, dto);
      expect(mockEscrowService.refundCoins).toHaveBeenCalledWith(
        mockTransactionId,
        mockUserId,
        'Changed mind',
      );
      expect(result.status).toBe('refunded');
    });
  });

  describe('list (listTransactions)', () => {
    it('should call service.listTransactions with defaults', async () => {
      await controller.list(mockRequest);
      expect(mockEscrowService.listTransactions).toHaveBeenCalledWith(
        mockUserId,
        undefined,
        20,
        0,
      );
    });

    it('should parse limit and offset query params', async () => {
      await controller.list(mockRequest, '10', '5');
      expect(mockEscrowService.listTransactions).toHaveBeenCalledWith(
        mockUserId,
        undefined,
        10,
        5,
      );
    });
  });

  describe('getById (getTransaction)', () => {
    it('should call service.getTransaction with correct params', async () => {
      const result = await controller.getById(
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

  describe('crash reports', () => {
    it('should list crash reports', async () => {
      mockCrashReportService.listUnresolved.mockResolvedValue([{ id: 'crash-1' }]);
      const result = await controller.listCrashReports();
      expect(mockCrashReportService.listUnresolved).toHaveBeenCalled();
      expect(result).toEqual([{ id: 'crash-1' }]);
    });

    it('should acknowledge a crash report', async () => {
      const result = await controller.acknowledgeCrashReport({ report_id: 'crash-1' });
      expect(mockCrashReportService.acknowledgeReport).toHaveBeenCalledWith('crash-1');
      expect(result).toEqual({ acknowledged: true });
    });

    it('should resolve a crash report', async () => {
      const result = await controller.resolveCrashReport({ report_id: 'crash-1' });
      expect(mockCrashReportService.resolveReport).toHaveBeenCalledWith('crash-1');
      expect(result).toEqual({ resolved: true });
    });
  });

  describe('error propagation', () => {
    it('should propagate holdCoins errors from service', async () => {
      const error = new Error('Hold error');
      mockEscrowService.holdCoins.mockRejectedValue(error);

      await expect(
        controller.create(mockRequest, {
          payee_id: mockPayeeId,
          amount_coins: 50,
          reason: 'Test',
        }),
      ).rejects.toThrow('Hold error');
    });

    it('should propagate releaseCoins errors from service', async () => {
      const error = new Error('Release error');
      mockEscrowService.releaseCoins.mockRejectedValue(error);

      await expect(
        controller.release(mockRequest, {
          transaction_id: mockTransactionId,
        }),
      ).rejects.toThrow('Release error');
    });

    it('should propagate refundCoins errors from service', async () => {
      const error = new Error('Refund error');
      mockEscrowService.refundCoins.mockRejectedValue(error);

      await expect(
        controller.refund(mockRequest, {
          transaction_id: mockTransactionId,
        }),
      ).rejects.toThrow('Refund error');
    });

    it('should propagate getTransaction errors from service', async () => {
      const error = new Error('Get error');
      mockEscrowService.getTransaction.mockRejectedValue(error);

      await expect(
        controller.getById(mockRequest, mockTransactionId),
      ).rejects.toThrow('Get error');
    });

    it('should propagate listTransactions errors from service', async () => {
      const error = new Error('List error');
      mockEscrowService.listTransactions.mockRejectedValue(error);

      await expect(controller.list(mockRequest)).rejects.toThrow(
        'List error',
      );
    });
  });
});

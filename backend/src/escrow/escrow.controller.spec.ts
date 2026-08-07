import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';

describe('EscrowController', () => {
  let controller: EscrowController;
  let mockEscrowService: Record<string, jest.Mock>;

  const mockUserId = '12345678-1234-1234-1234-123456789012';
  const mockPayeeId = '87654321-4321-4321-4321-210987654321';
  const mockTransactionId = '99999999-9999-9999-9999-999999999999';

  const mockRequest = {
    user: { sub: mockUserId },
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
      cancelEscrow: jest.fn().mockResolvedValue({
        id: mockTransactionId,
        status: 'cancelled',
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

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EscrowController],
      providers: [
        {
          provide: EscrowService,
          useValue: mockEscrowService,
        },
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

  describe('holdCoins', () => {
    it('should call service.holdCoins with correct params', async () => {
      const dto = {
        payee_id: mockPayeeId,
        amount_coins: 50,
        reason: 'Test',
      };

      const result = await controller.holdCoins(mockRequest, dto);
      expect(mockEscrowService.holdCoins).toHaveBeenCalledWith(mockUserId, dto);
      expect(result.success).toBe(true);
      expect(result.transaction_id).toBe(mockTransactionId);
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
});

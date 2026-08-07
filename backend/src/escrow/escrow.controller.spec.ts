import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { EscrowController } from './escrow.controller';
import { EscrowExceptionFilter } from './escrow-exception.filter';
import { EscrowService } from './escrow.service';
<<<<<<< HEAD
<<<<<<< HEAD
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('EscrowController', () => {
  let controller: EscrowController;

  const mockEscrowService = {
    createEscrow: jest.fn(),
    getUserEscrows: jest.fn(),
    getEscrow: jest.fn(),
    getMilestones: jest.fn(),
    releaseMilestone: jest.fn(),
    disputeEscrow: jest.fn(),
    scrubExpiredData: jest.fn(),
    getPiiReport: jest.fn(),
    requestDataDeletion: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

=======
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { UnauthorizedException } from '@nestjs/common';
=======
>>>>>>> origin/main

// Mock the sanitise helper to avoid ESM import issues with jsdom/dompurify
jest.mock('./sanitise-escrow.helper', () => ({
  sanitiseEscrowData: <T>(value: T): T => value,
}));

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
<<<<<<< HEAD
>>>>>>> origin/main
=======
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

>>>>>>> origin/main
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EscrowController],
      providers: [
        {
          provide: EscrowService,
<<<<<<< HEAD
<<<<<<< HEAD
          useValue: mockEscrowService,
=======
          useValue: {
            createEscrow: jest.fn(),
            releaseEscrow: jest.fn(),
            refundEscrow: jest.fn(),
            getEscrow: jest.fn(),
            listEscrows: jest.fn(),
          },
>>>>>>> origin/main
=======
          useValue: mockEscrowService,
>>>>>>> origin/main
        },
        {
          provide: CrashReportService,
          useValue: {
            reportCrash: jest.fn(),
            listUnresolved: jest.fn(),
            acknowledgeReport: jest.fn(),
            resolveReport: jest.fn(),
          },
        },
        EscrowExceptionFilter,
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
<<<<<<< HEAD
<<<<<<< HEAD
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<EscrowController>(EscrowController);
=======
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
=======
      .useValue({ canActivate: jest.fn().mockResolvedValue(true) })
>>>>>>> origin/main
      .compile();

    controller = module.get<EscrowController>(EscrowController);
  });

  afterEach(() => {
    jest.clearAllMocks();
>>>>>>> origin/main
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

<<<<<<< HEAD
<<<<<<< HEAD
  describe('createEscrow', () => {
    it('should call service.createEscrow with user id', async () => {
      const dto = {
        transaction_subject: 'Test',
        amount_cents: 10000,
        currency: 'usd',
        recipient_id: 'user-2',
      };
      const mockReq = { user: { id: 'user-1' } } as any;
      const mockResult = { id: 'escrow-1', ...dto };
      mockEscrowService.createEscrow.mockResolvedValue(mockResult);

      const result = await controller.createEscrow(dto, mockReq);

      expect(mockEscrowService.createEscrow).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('getUserEscrows', () => {
    it('should return user escrows', async () => {
      const mockReq = { user: { id: 'user-1' } } as any;
      const mockEscrows = [{ id: 'escrow-1' }, { id: 'escrow-2' }];
      mockEscrowService.getUserEscrows.mockResolvedValue(mockEscrows);

      const result = await controller.getUserEscrows(mockReq);

      expect(mockEscrowService.getUserEscrows).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockEscrows);
    });
  });

  describe('getEscrow', () => {
    it('should return single escrow', async () => {
      const mockReq = { user: { id: 'user-1' } } as any;
      const mockEscrow = { id: 'escrow-1' };
      mockEscrowService.getEscrow.mockResolvedValue(mockEscrow);

      const result = await controller.getEscrow('escrow-1', mockReq);

      expect(mockEscrowService.getEscrow).toHaveBeenCalledWith(
        'user-1',
        'escrow-1',
      );
      expect(result).toEqual(mockEscrow);
    });
  });

  describe('getMilestones', () => {
    it('should return milestones for escrow', async () => {
      const mockReq = { user: { id: 'user-1' } } as any;
      const mockMilestones = [{ id: 'mile-1' }, { id: 'mile-2' }];
      mockEscrowService.getMilestones.mockResolvedValue(mockMilestones);

      const result = await controller.getMilestones('escrow-1', mockReq);

      expect(mockEscrowService.getMilestones).toHaveBeenCalledWith(
        'user-1',
        'escrow-1',
      );
      expect(result).toEqual(mockMilestones);
    });
  });

  describe('releaseMilestone', () => {
    it('should call service.releaseMilestone', async () => {
      const dto = {
        escrow_id: 'escrow-1',
        milestone_id: 'mile-1',
        release_note: 'Done',
      };
      const mockReq = { user: { id: 'user-1' } } as any;
      mockEscrowService.releaseMilestone.mockResolvedValue({
        ...dto,
        status: 'released',
      });

      await controller.releaseMilestone(dto, mockReq);

      expect(mockEscrowService.releaseMilestone).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
    });
  });

  describe('disputeEscrow', () => {
    it('should call service.disputeEscrow', async () => {
      const dto = { escrow_id: 'escrow-1', reason: 'Issue' };
      const mockReq = { user: { id: 'user-1' } } as any;
      mockEscrowService.disputeEscrow.mockResolvedValue({
        id: 'dispute-1',
        ...dto,
      });

      await controller.disputeEscrow(dto, mockReq);

      expect(mockEscrowService.disputeEscrow).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
    });
  });

  describe('scrubExpiredData', () => {
    it('should call service.scrubExpiredData', async () => {
      mockEscrowService.scrubExpiredData.mockResolvedValue([]);

      const result = await controller.scrubExpiredData();

      expect(mockEscrowService.scrubExpiredData).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('getPiiReport', () => {
    it('should call service.getPiiReport', async () => {
      mockEscrowService.getPiiReport.mockResolvedValue({
        hasPii: false,
        details: {},
      });

      const result = await controller.getPiiReport('escrow-1');

      expect(mockEscrowService.getPiiReport).toHaveBeenCalledWith('escrow-1');
      expect(result.hasPii).toBe(false);
    });
  });
});
=======
  describe('create', () => {
    it('should throw UnauthorizedException if no user', async () => {
      await expect(
        controller.create({ user: undefined } as never, { payee_id: 'payee-1', amount_coins: 100 }),
      ).rejects.toThrow(UnauthorizedException);
    });
=======
  describe('holdCoins', () => {
    it('should call service.holdCoins with correct params', async () => {
      const dto = {
        payee_id: mockPayeeId,
        amount_coins: 50,
        reason: 'Test',
      };
>>>>>>> origin/main

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
<<<<<<< HEAD
});
>>>>>>> origin/main
=======

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
    it('should propagate holdCoins errors from service', async () => {
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

    it('should propagate releaseCoins errors from service', async () => {
      const error = new Error('Release error');
      mockEscrowService.releaseCoins.mockRejectedValue(error);

      await expect(
        controller.releaseCoins(mockRequest, {
          transaction_id: mockTransactionId,
        }),
      ).rejects.toThrow('Release error');
    });

    it('should propagate refundCoins errors from service', async () => {
      const error = new Error('Refund error');
      mockEscrowService.refundCoins.mockRejectedValue(error);

      await expect(
        controller.refundCoins(mockRequest, {
          transaction_id: mockTransactionId,
        }),
      ).rejects.toThrow('Refund error');
    });

    it('should propagate cancelEscrow errors from service', async () => {
      const error = new Error('Cancel error');
      mockEscrowService.cancelEscrow.mockRejectedValue(error);

      await expect(
        controller.cancelEscrow(mockRequest, {
          transaction_id: mockTransactionId,
        }),
      ).rejects.toThrow('Cancel error');
    });

    it('should propagate getTransaction errors from service', async () => {
      const error = new Error('Get error');
      mockEscrowService.getTransaction.mockRejectedValue(error);

      await expect(
        controller.getTransaction(mockRequest, mockTransactionId),
      ).rejects.toThrow('Get error');
    });

    it('should propagate listTransactions errors from service', async () => {
      const error = new Error('List error');
      mockEscrowService.listTransactions.mockRejectedValue(error);

      await expect(controller.listTransactions(mockRequest)).rejects.toThrow(
        'List error',
      );
    });
  });
});
>>>>>>> origin/main

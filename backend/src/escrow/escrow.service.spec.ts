import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MonetisationService } from '../monetisation/monetisation.service';
import { RetryService } from '../common/retry/retry.service';

describe('EscrowService', () => {
  let service: EscrowService;
  let monetisationService: MonetisationService;
  let mockQueryBuilder: any;
  let module: TestingModule;

  /** Build a mock retry service that passes through the operation directly. */
  const mockRetryService = {
    withRetry: jest.fn((operation: () => Promise<unknown>) => {
      return operation().then((result: unknown) => ({
        result,
        attempts: 1,
        totalTimeMs: 0,
      }));
    }),
  };

  beforeEach(async () => {
    mockQueryBuilder = {
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
    };

    const mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    module = await Test.createTestingModule({
      providers: [
        EscrowService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: MonetisationService,
          useValue: {
            deductCoins: jest.fn(),
            addCoins: jest.fn(),
            getCoinsBalance: jest.fn(),
          },
        },
        {
          provide: RetryService,
          useValue: mockRetryService,
        },
      ],
    }).compile();

    service = module.get<EscrowService>(EscrowService);
    monetisationService = module.get<MonetisationService>(MonetisationService);

    jest.clearAllMocks();
  });

  /** Clean up module to release OnModuleDestroy timer (#2396). */
  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createEscrow', () => {
    const payerId = 'payer-1';
    const dto = { payee_id: 'payee-1', amount_coins: 100 };

    it('should throw if payer is payee', async () => {
      await expect(
        service.createEscrow(payerId, { ...dto, payee_id: payerId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if payee does not exist', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });
      await expect(service.createEscrow(payerId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should create escrow successfully', async () => {
      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: { id: 'payee-1' }, error: null })
        .mockResolvedValueOnce({
          data: {
            id: 'escrow-1',
            payer_id: payerId,
            payee_id: dto.payee_id,
            amount_coins: 100,
            status: 'held',
            description: null,
            reference_id: null,
          },
          error: null,
        });

      (monetisationService.deductCoins as jest.Mock).mockResolvedValue(50);

      const result = await service.createEscrow(payerId, dto);

      expect(monetisationService.deductCoins).toHaveBeenCalledWith(
        payerId,
        100,
      );
      expect(result).toEqual({
        id: 'escrow-1',
        status: 'held',
        amount_coins: 100,
        payer_balance: 50,
      });
    });

    it('should return existing escrow when idempotency key matches', async () => {
      const existing = {
        id: 'escrow-existing',
        payer_id: payerId,
        payee_id: dto.payee_id,
        amount_coins: 100,
        status: 'held',
        created_at: '2026-08-07T00:00:00Z',
        updated_at: '2026-08-07T00:00:00Z',
      };
      mockQueryBuilder.maybeSingle.mockResolvedValue({
        data: existing,
        error: null,
      });
      (monetisationService.getCoinsBalance as jest.Mock).mockResolvedValue(50);

      const result = await service.createEscrow(payerId, {
        ...dto,
        idempotency_key: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(monetisationService.deductCoins).not.toHaveBeenCalled();
      expect(result).toEqual({
        id: 'escrow-existing',
        status: 'held',
        amount_coins: 100,
        payer_balance: 50,
      });
    });

    it('should refund coins with retry if escrow insert fails', async () => {
      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: { id: 'payee-1' }, error: null })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Insert failed' },
        });

      (monetisationService.deductCoins as jest.Mock).mockResolvedValue(50);
      (monetisationService.addCoins as jest.Mock).mockResolvedValue(150);

      await expect(service.createEscrow(payerId, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(monetisationService.addCoins).toHaveBeenCalledWith(payerId, 100);
      expect(mockRetryService.withRetry).toHaveBeenCalled();
    });
  });

  describe('releaseEscrow', () => {
    const escrowId = 'escrow-1';
    const userId = 'payer-1';
    const heldEscrow = {
      id: escrowId,
      payer_id: userId,
      payee_id: 'payee-1',
      amount_coins: 100,
      status: 'held' as const,
      description: null,
      reference_id: null,
      created_at: '2026-08-07T00:00:00Z',
      updated_at: '2026-08-07T00:00:00Z',
      released_at: null,
      refunded_at: null,
    };

    it('should throw if escrow not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });
      await expect(service.releaseEscrow(userId, escrowId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if user is not the payer', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { ...heldEscrow, payer_id: 'other-user' },
        error: null,
      });
      await expect(service.releaseEscrow(userId, escrowId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw if escrow is not in held status', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { ...heldEscrow, status: 'released' },
        error: null,
      });
      await expect(service.releaseEscrow(userId, escrowId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should release escrow successfully via release_pending', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { ...heldEscrow },
        error: null,
      });
      // Phase 1: transition to release_pending succeeds
      mockQueryBuilder.update
        .mockReturnValueOnce({
          eq: jest.fn().mockReturnThis(),
          select: jest.fn(),
        } as any)
        .mockReturnValueOnce({
          eq: jest.fn().mockReturnThis(),
          select: jest.fn(),
        } as any);
      // Simulate the eq().eq() chain for transition to release_pending
      const eqMockForPending = jest.fn().mockResolvedValue({ error: null });
      const eqMockForReleased = jest.fn().mockResolvedValue({ error: null });
      mockQueryBuilder.update
        .mockReturnValueOnce({
          eq: jest.fn().mockReturnValue({ eq: eqMockForPending }),
        })
        .mockReturnValueOnce({
          eq: jest.fn().mockReturnValue({ eq: eqMockForReleased }),
        });

      (monetisationService.addCoins as jest.Mock).mockResolvedValue(200);

      const result = await service.releaseEscrow(userId, escrowId);

      expect(result).toEqual({
        id: escrowId,
        status: 'released',
        amount_coins: 100,
        payee_balance: 200,
      });
    });

    it('should finalise release_pending escrow', async () => {
      const pendingEscrow = {
        ...heldEscrow,
        status: 'release_pending' as const,
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: { ...pendingEscrow },
        error: null,
      });

      const eqMockForReleased = jest.fn().mockResolvedValue({ error: null });
      mockQueryBuilder.update.mockReturnValueOnce({
        eq: jest.fn().mockReturnValue({ eq: eqMockForReleased }),
      });

      (monetisationService.addCoins as jest.Mock).mockResolvedValue(200);

      const result = await service.releaseEscrow(userId, escrowId);

      expect(result).toEqual({
        id: escrowId,
        status: 'released',
        amount_coins: 100,
        payee_balance: 200,
      });
    });
  });

  describe('refundEscrow', () => {
    const escrowId = 'escrow-1';
    const userId = 'payer-1';
    const heldEscrow = {
      id: escrowId,
      payer_id: userId,
      payee_id: 'payee-1',
      amount_coins: 100,
      status: 'held' as const,
      description: null,
      reference_id: null,
      created_at: '2026-08-07T00:00:00Z',
      updated_at: '2026-08-07T00:00:00Z',
      released_at: null,
      refunded_at: null,
    };

    it('should throw if escrow not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });
      await expect(service.refundEscrow(userId, escrowId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if user is not the payer', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { ...heldEscrow, payer_id: 'other-user' },
        error: null,
      });
      await expect(service.refundEscrow(userId, escrowId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw if escrow is not in held status', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { ...heldEscrow, status: 'refunded' },
        error: null,
      });
      await expect(service.refundEscrow(userId, escrowId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should refund escrow successfully via refund_pending', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { ...heldEscrow },
        error: null,
      });

      const eqMockForPending = jest.fn().mockResolvedValue({ error: null });
      const eqMockForRefunded = jest.fn().mockResolvedValue({ error: null });
      mockQueryBuilder.update
        .mockReturnValueOnce({
          eq: jest.fn().mockReturnValue({ eq: eqMockForPending }),
        })
        .mockReturnValueOnce({
          eq: jest.fn().mockReturnValue({ eq: eqMockForRefunded }),
        });

      (monetisationService.addCoins as jest.Mock).mockResolvedValue(150);

      const result = await service.refundEscrow(userId, escrowId);

      expect(result).toEqual({
        id: escrowId,
        status: 'refunded',
        amount_coins: 100,
        payer_balance: 150,
      });
    });

    it('should finalise refund_pending escrow', async () => {
      const pendingEscrow = {
        ...heldEscrow,
        status: 'refund_pending' as const,
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: { ...pendingEscrow },
        error: null,
      });

      const eqMockForRefunded = jest.fn().mockResolvedValue({ error: null });
      mockQueryBuilder.update.mockReturnValueOnce({
        eq: jest.fn().mockReturnValue({ eq: eqMockForRefunded }),
      });

      (monetisationService.addCoins as jest.Mock).mockResolvedValue(150);

      const result = await service.refundEscrow(userId, escrowId);

      expect(result).toEqual({
        id: escrowId,
        status: 'refunded',
        amount_coins: 100,
        payer_balance: 150,
      });
    });
  });

  describe('reconcileEscrow', () => {
    const escrowId = 'escrow-1';
    const userId = 'payer-1';

    it('should throw if user is not a participant', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: {
          id: escrowId,
          payer_id: 'other-1',
          payee_id: 'other-2',
          status: 'release_pending',
          amount_coins: 100,
        },
        error: null,
      });
      await expect(service.reconcileEscrow(userId, escrowId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return already_consistent for non-degraded escrow', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: {
          id: escrowId,
          payer_id: userId,
          payee_id: 'payee-1',
          amount_coins: 100,
          status: 'held',
          created_at: '2026-08-07T00:00:00Z',
        },
        error: null,
      });

      const result = await service.reconcileEscrow(userId, escrowId);
      expect(result).toEqual({
        id: escrowId,
        status: 'held',
        amount_coins: 100,
        reconciliation: 'already_consistent',
      });
    });

    it('should reconcile release_pending escrow', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: {
          id: escrowId,
          payer_id: userId,
          payee_id: 'payee-1',
          amount_coins: 100,
          status: 'release_pending',
          created_at: '2026-08-07T00:00:00Z',
          updated_at: '2026-08-07T00:00:00Z',
          released_at: null,
          refunded_at: null,
        },
        error: null,
      });

      const eqMockForReleased = jest.fn().mockResolvedValue({ error: null });
      mockQueryBuilder.update.mockReturnValueOnce({
        eq: jest.fn().mockReturnValue({ eq: eqMockForReleased }),
      });

      (monetisationService.addCoins as jest.Mock).mockResolvedValue(200);

      const result = await service.reconcileEscrow(userId, escrowId);

      expect(result).toEqual({
        id: escrowId,
        status: 'released',
        amount_coins: 100,
        reconciliation: 'completed',
      });
    });

    it('should reconcile refund_pending escrow', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: {
          id: escrowId,
          payer_id: userId,
          payee_id: 'payee-1',
          amount_coins: 100,
          status: 'refund_pending',
          created_at: '2026-08-07T00:00:00Z',
          updated_at: '2026-08-07T00:00:00Z',
          released_at: null,
          refunded_at: null,
        },
        error: null,
      });

      const eqMockForRefunded = jest.fn().mockResolvedValue({ error: null });
      mockQueryBuilder.update.mockReturnValueOnce({
        eq: jest.fn().mockReturnValue({ eq: eqMockForRefunded }),
      });

      (monetisationService.addCoins as jest.Mock).mockResolvedValue(150);

      const result = await service.reconcileEscrow(userId, escrowId);

      expect(result).toEqual({
        id: escrowId,
        status: 'refunded',
        amount_coins: 100,
        reconciliation: 'completed',
      });
    });

    it('should allow payee to reconcile release_pending', async () => {
      const payeeId = 'payee-1';
      mockQueryBuilder.single.mockResolvedValue({
        data: {
          id: escrowId,
          payer_id: userId,
          payee_id: payeeId,
          amount_coins: 100,
          status: 'release_pending',
          created_at: '2026-08-07T00:00:00Z',
          updated_at: '2026-08-07T00:00:00Z',
          released_at: null,
          refunded_at: null,
        },
        error: null,
      });

      const eqMockForReleased = jest.fn().mockResolvedValue({ error: null });
      mockQueryBuilder.update.mockReturnValueOnce({
        eq: jest.fn().mockReturnValue({ eq: eqMockForReleased }),
      });

      (monetisationService.addCoins as jest.Mock).mockResolvedValue(200);

      const result = await service.reconcileEscrow(payeeId, escrowId);

      expect(result).toEqual({
        id: escrowId,
        status: 'released',
        amount_coins: 100,
        reconciliation: 'completed',
      });
    });
  });

  describe('getEscrow', () => {
    const escrowId = 'escrow-1';
    const userId = 'payer-1';

    it('should throw if escrow not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });
      await expect(service.getEscrow(userId, escrowId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if user is not a participant', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { id: escrowId, payer_id: 'other-1', payee_id: 'other-2' },
        error: null,
      });
      await expect(service.getEscrow(userId, escrowId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return escrow for payer', async () => {
      const escrowData = {
        id: escrowId,
        payer_id: userId,
        payee_id: 'payee-1',
        amount_coins: 50,
        status: 'held',
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: escrowData,
        error: null,
      });
      const result = await service.getEscrow(userId, escrowId);
      expect(result).toEqual(escrowData);
    });
  });

  describe('listEscrows', () => {
    const userId = 'payer-1';

    it('should return escrow list with count', async () => {
      const escrowData = [
        {
          id: 'escrow-1',
          payer_id: userId,
          payee_id: 'payee-1',
          amount_coins: 50,
          status: 'held',
        },
      ];
      mockQueryBuilder.range.mockResolvedValue({
        data: escrowData,
        error: null,
        count: 1,
      });

      const result = await service.listEscrows(userId);
      expect(result).toEqual({ escrows: escrowData, total: 1 });
    });

    it('should handle empty results', async () => {
      mockQueryBuilder.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });
      const result = await service.listEscrows(userId);
      expect(result).toEqual({ escrows: [], total: 0 });
    });
  });
});

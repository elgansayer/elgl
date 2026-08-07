import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
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
  ConflictException,
} from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MonetisationService } from '../monetisation/monetisation.service';

describe('EscrowService', () => {
  let service: EscrowService;
  let monetisationService: MonetisationService;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    const mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
>>>>>>> origin/main
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
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
      ],
    }).compile();

    service = module.get<EscrowService>(EscrowService);
<<<<<<< HEAD
=======
    monetisationService = module.get<MonetisationService>(MonetisationService);

    jest.clearAllMocks();
>>>>>>> origin/main
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

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

    it('should throw if payer is payee', async () => {
      await expect(
        service.createEscrow(payerId, { ...dto, payee_id: payerId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if payee does not exist', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });
      await expect(service.createEscrow(payerId, dto)).rejects.toThrow(NotFoundException);
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

      expect(monetisationService.deductCoins).toHaveBeenCalledWith(payerId, 100);
      expect(result).toEqual({
        id: 'escrow-1',
        status: 'held',
        amount_coins: 100,
        payer_balance: 50,
      });
    });

    it('should refund coins if escrow insert fails', async () => {
      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: { id: 'payee-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Insert failed' } });

      (monetisationService.deductCoins as jest.Mock).mockResolvedValue(50);
      (monetisationService.addCoins as jest.Mock).mockResolvedValue(150);

      await expect(service.createEscrow(payerId, dto)).rejects.toThrow(BadRequestException);
      expect(monetisationService.addCoins).toHaveBeenCalledWith(payerId, 100);
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
      status: 'held',
      description: null,
      reference_id: null,
      created_at: '2026-08-07T00:00:00Z',
      updated_at: '2026-08-07T00:00:00Z',
      released_at: null,
      refunded_at: null,
    };

    it('should throw if escrow not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });
      await expect(service.releaseEscrow(userId, escrowId)).rejects.toThrow(NotFoundException);
    });

    it('should throw if user is not the payer', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { ...heldEscrow, payer_id: 'other-user' },
        error: null,
      });
      await expect(service.releaseEscrow(userId, escrowId)).rejects.toThrow(ForbiddenException);
    });

    it('should throw if escrow is not in held status', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { ...heldEscrow, status: 'released' },
        error: null,
      });
      await expect(service.releaseEscrow(userId, escrowId)).rejects.toThrow(ConflictException);
    });

    it('should release escrow successfully', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: heldEscrow, error: null });
      (monetisationService.addCoins as jest.Mock).mockResolvedValue(200);

      const result = await service.releaseEscrow(userId, escrowId);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        status: 'released',
        released_at: expect.any(String) as string,
        updated_at: expect.any(String) as string,
      });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', escrowId);
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
      status: 'held',
      description: null,
      reference_id: null,
      created_at: '2026-08-07T00:00:00Z',
      updated_at: '2026-08-07T00:00:00Z',
      released_at: null,
      refunded_at: null,
    };

    it('should throw if escrow not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });
      await expect(service.refundEscrow(userId, escrowId)).rejects.toThrow(NotFoundException);
    });

    it('should throw if user is not the payer', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { ...heldEscrow, payer_id: 'other-user' },
        error: null,
      });
      await expect(service.refundEscrow(userId, escrowId)).rejects.toThrow(ForbiddenException);
    });

    it('should throw if escrow is not in held status', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { ...heldEscrow, status: 'refunded' },
        error: null,
      });
      await expect(service.refundEscrow(userId, escrowId)).rejects.toThrow(ConflictException);
    });

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

    it('should throw if escrow not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });
      await expect(service.getEscrow(userId, escrowId)).rejects.toThrow(NotFoundException);
    });

    it('should throw if user is not a participant', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { id: escrowId, payer_id: 'other-1', payee_id: 'other-2' },
        error: null,
      });
      await expect(service.getEscrow(userId, escrowId)).rejects.toThrow(ForbiddenException);
    });

    it('should return escrow for payer', async () => {
      const escrowData = { id: escrowId, payer_id: userId, payee_id: 'payee-1', amount_coins: 50, status: 'held' };
      mockQueryBuilder.single.mockResolvedValue({ data: escrowData, error: null });
      const result = await service.getEscrow(userId, escrowId);
      expect(result).toEqual(escrowData);
    });
  });

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

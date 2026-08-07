import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';

describe('EscrowService', () => {
  let service: EscrowService;
  let mockQueryBuilder: any;
  let mockSupabaseClient: any;

  const PAYER_ID = '00000000-0000-0000-0000-000000000001';
  const PAYEE_ID = '00000000-0000-0000-0000-000000000002';
  const ADMIN_ID = '00000000-0000-0000-0000-000000000099';
  const ESCROW_ID = '11111111-1111-1111-1111-111111111111';
  const DISPUTE_ID = '22222222-2222-2222-2222-222222222222';

  const makeEscrowRow = (overrides: Record<string, unknown> = {}) => ({
    id: ESCROW_ID,
    payer_id: PAYER_ID,
    payee_id: PAYEE_ID,
    amount_coins: 100,
    status: 'pending_held',
    milestone_description: 'Test milestone',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    released_at: null,
    ...overrides,
  });

  const makeDisputeRow = (overrides: Record<string, unknown> = {}) => ({
    id: DISPUTE_ID,
    escrow_transaction_id: ESCROW_ID,
    raised_by_id: PAYER_ID,
    reason: 'Not delivered',
    resolution: 'pending',
    resolution_notes: '',
    resolved_by_id: null,
    created_at: '2026-01-02T00:00:00.000Z',
    resolved_at: null,
    ...overrides,
  });

  beforeEach(async () => {
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const mockSupabaseService = {
      getClient: jest.fn().mockReturnValue(mockSupabaseClient),
    };

    const mockUsersService = {
      getProfile: jest.fn().mockResolvedValue({ id: PAYEE_ID, display_name: 'payee' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: UsersService, useValue: mockUsersService },
        {
          provide: 'PinoLogger:EscrowService',
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EscrowService>(EscrowService);
  });

  describe('createEscrow', () => {
    it('should create an escrow transaction and deduct coins', async () => {
      mockQueryBuilder.select.mockReturnThis();
      mockQueryBuilder.eq.mockReturnThis();
      mockQueryBuilder.update.mockReturnThis();
      mockQueryBuilder.insert.mockReturnThis();
      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: { coins_balance: 500 }, error: null })
        .mockResolvedValueOnce({ data: makeEscrowRow(), error: null });

      const result = await service.createEscrow(PAYER_ID, {
        payee_id: PAYEE_ID,
        amount_coins: 100,
        milestone_description: 'Translate document',
      });

      expect(result.status).toBe('pending_held');
      expect(result.amount_coins).toBe(100);
      expect(result.payer_id).toBe(PAYER_ID);
    });

    it('should reject self-escrow', async () => {
      await expect(
        service.createEscrow(PAYER_ID, {
          payee_id: PAYER_ID,
          amount_coins: 100,
          milestone_description: 'Test',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when payer has insufficient balance', async () => {
      mockQueryBuilder.select.mockReturnThis();
      mockQueryBuilder.eq.mockReturnThis();
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { coins_balance: 50 },
        error: null,
      });

      await expect(
        service.createEscrow(PAYER_ID, {
          payee_id: PAYEE_ID,
          amount_coins: 100,
          milestone_description: 'Test',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('releaseEscrow', () => {
    it('should release funds to payee', async () => {
      mockQueryBuilder.select.mockReturnThis();
      mockQueryBuilder.eq.mockReturnThis();
      mockQueryBuilder.update.mockReturnThis();
      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: makeEscrowRow(), error: null })
        .mockResolvedValueOnce({ data: { coins_balance: 200 }, error: null })
        .mockResolvedValueOnce({
          data: makeEscrowRow({ status: 'released' }),
          error: null,
        });

      const result = await service.releaseEscrow(ESCROW_ID, PAYER_ID);
      expect(result.status).toBe('released');
    });

    it('should reject release from non-payer', async () => {
      mockQueryBuilder.select.mockReturnThis();
      mockQueryBuilder.eq.mockReturnThis();
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: makeEscrowRow(),
        error: null,
      });

      await expect(
        service.releaseEscrow(ESCROW_ID, PAYEE_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refundEscrow', () => {
    it('should refund coins to payer', async () => {
      mockQueryBuilder.select.mockReturnThis();
      mockQueryBuilder.eq.mockReturnThis();
      mockQueryBuilder.update.mockReturnThis();
      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: makeEscrowRow(), error: null })
        .mockResolvedValueOnce({ data: { coins_balance: 400 }, error: null })
        .mockResolvedValueOnce({
          data: makeEscrowRow({ status: 'refunded' }),
          error: null,
        });

      const result = await service.refundEscrow(ESCROW_ID, PAYER_ID);
      expect(result.status).toBe('refunded');
    });
  });

  describe('raiseDispute', () => {
    it('should raise a dispute', async () => {
      mockQueryBuilder.select.mockReturnThis();
      mockQueryBuilder.eq.mockReturnThis();
      mockQueryBuilder.update.mockReturnThis();
      mockQueryBuilder.insert.mockReturnThis();
      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: makeEscrowRow(), error: null })
        .mockResolvedValueOnce({ data: makeDisputeRow(), error: null });

      const result = await service.raiseDispute(
        ESCROW_ID,
        PAYER_ID,
        'Not delivered',
      );
      expect(result.resolution).toBe('pending');
    });

    it('should reject dispute from uninvolved user', async () => {
      mockQueryBuilder.select.mockReturnThis();
      mockQueryBuilder.eq.mockReturnThis();
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: makeEscrowRow(),
        error: null,
      });

      await expect(
        service.raiseDispute(ESCROW_ID, ADMIN_ID, 'Random'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resolveDispute', () => {
    it('should resolve dispute by releasing to payee', async () => {
      mockQueryBuilder.select.mockReturnThis();
      mockQueryBuilder.eq.mockReturnThis();
      mockQueryBuilder.update.mockReturnThis();
      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: makeDisputeRow(), error: null })
        .mockResolvedValueOnce({
          data: makeEscrowRow({ status: 'disputed' }),
          error: null,
        })
        .mockResolvedValueOnce({ data: { coins_balance: 200 }, error: null })
        .mockResolvedValueOnce({
          data: makeDisputeRow({
            resolution: 'released_to_payee',
            resolved_by_id: ADMIN_ID,
          }),
          error: null,
        });

      const result = await service.resolveDispute(
        DISPUTE_ID,
        'released_to_payee',
        ADMIN_ID,
        'Evidence shows delivery',
      );
      expect(result.resolution).toBe('released_to_payee');
      expect(result.resolved_by_id).toBe(ADMIN_ID);
    });

    it('should reject resolving an already-resolved dispute', async () => {
      mockQueryBuilder.select.mockReturnThis();
      mockQueryBuilder.eq.mockReturnThis();
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: makeDisputeRow({ resolution: 'released_to_payee' }),
        error: null,
      });

      await expect(
        service.resolveDispute(DISPUTE_ID, 'refunded_to_payer', ADMIN_ID),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getEscrowTransactionsForUser', () => {
    it('should list escrow transactions for a user', async () => {
      mockQueryBuilder.select.mockReturnThis();
      mockQueryBuilder.or.mockReturnThis();
      mockQueryBuilder.order.mockReturnValue({
        data: [makeEscrowRow(), makeEscrowRow({ id: '9999', status: 'released' })],
        error: null,
      });

      const result = await service.getEscrowTransactionsForUser(PAYER_ID);
      expect(result).toHaveLength(2);
    });
  });
});
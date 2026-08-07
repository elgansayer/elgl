import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EscrowPaymentsService } from './escrow-payments.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { EscrowStatus } from './dto/escrow.dto';
import {
  EscrowNotFoundException,
  EscrowInsufficientFundsException,
  EscrowInvalidStateException,
  EscrowAlreadyDisputedException,
  EscrowExpiredException,
} from './exceptions/escrow.exceptions';

describe('EscrowPaymentsService', () => {
  let service: EscrowPaymentsService;
  let mockEscrowBuilder: any;
  let mockUsersBuilder: any;
  let mockSupabaseClient: any;
  let mockAnalyticsService: { recordClientError: jest.Mock };

  const PARTY_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const PARTY_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const ESCROW_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

  function makeEscrowRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: ESCROW_ID,
      party_a_id: PARTY_A,
      party_b_id: PARTY_B,
      amount: 100,
      currency: 'coins',
      status: EscrowStatus.AWAITING_DEPOSIT,
      description: null,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      dispute_reason: null,
      dispute_opened_at: null,
      resolution: null,
      admin_notes: null,
      cancelled_reason: null,
      ...overrides,
    };
  }

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    mockEscrowBuilder = {
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn(),
      or: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    mockUsersBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    mockSupabaseClient = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'users') return mockUsersBuilder;
        return mockEscrowBuilder;
      }),
    };

    mockAnalyticsService = { recordClientError: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowPaymentsService,
        { provide: SupabaseService, useValue: { getClient: jest.fn().mockReturnValue(mockSupabaseClient) } },
        { provide: AnalyticsService, useValue: mockAnalyticsService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test-value') } },
      ],
    }).compile();

    service = module.get<EscrowPaymentsService>(EscrowPaymentsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createEscrow', () => {
    it('creates an escrow successfully', async () => {
      const row = makeEscrowRow();
      mockEscrowBuilder.single.mockResolvedValue({ data: row, error: null });

      const result = await service.createEscrow(PARTY_A, {
        partyBId: PARTY_B, amount: 100, currency: 'coins',
      });

      expect(mockEscrowBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          party_a_id: PARTY_A, party_b_id: PARTY_B,
          amount: 100, currency: 'coins',
          status: EscrowStatus.AWAITING_DEPOSIT,
        }),
      );
      expect(result.status).toBe(EscrowStatus.AWAITING_DEPOSIT);
    });

    it('throws on database error', async () => {
      mockEscrowBuilder.single.mockResolvedValue({ data: null, error: { message: 'DB failure' } });
      await expect(
        service.createEscrow(PARTY_A, { partyBId: PARTY_B, amount: 100, currency: 'coins' }),
      ).rejects.toThrow('Payment gateway error: DB failure');
    });

    it('throws when party equals self', async () => {
      await expect(
        service.createEscrow(PARTY_A, { partyBId: PARTY_A, amount: 100, currency: 'coins' }),
      ).rejects.toThrow('cannot escrow with self');
    });
  });

  describe('depositFunds', () => {
    it('deposits successfully', async () => {
      const row = makeEscrowRow({ status: EscrowStatus.AWAITING_DEPOSIT });
      const fundedRow = { ...row, status: EscrowStatus.FUNDS_HELD };
      mockUsersBuilder.single.mockResolvedValue({ data: { coins_balance: 500 }, error: null });
      mockEscrowBuilder.single
        .mockResolvedValueOnce({ data: row, error: null })
        .mockResolvedValueOnce({ data: fundedRow, error: null });

      const result = await service.depositFunds(PARTY_A, ESCROW_ID);
      expect(result.status).toBe(EscrowStatus.FUNDS_HELD);
    });

    it('throws on insufficient balance', async () => {
      const row = makeEscrowRow({ status: EscrowStatus.AWAITING_DEPOSIT, amount: 1000 });
      mockUsersBuilder.single.mockResolvedValue({ data: { coins_balance: 50 }, error: null });
      mockEscrowBuilder.single.mockResolvedValue({ data: row, error: null });

      await expect(service.depositFunds(PARTY_A, ESCROW_ID))
        .rejects.toThrow(EscrowInsufficientFundsException);
    });

    it('throws when expired', async () => {
      const row = makeEscrowRow({ status: EscrowStatus.AWAITING_DEPOSIT,
        expires_at: new Date(Date.now() - 1000).toISOString() });
      mockEscrowBuilder.single.mockResolvedValue({ data: row, error: null });

      await expect(service.depositFunds(PARTY_A, ESCROW_ID))
        .rejects.toThrow(EscrowExpiredException);
    });

    it('throws when not party A', async () => {
      const row = makeEscrowRow({ status: EscrowStatus.AWAITING_DEPOSIT });
      mockEscrowBuilder.single.mockResolvedValue({ data: row, error: null });

      await expect(service.depositFunds(PARTY_B, ESCROW_ID))
        .rejects.toThrow('not authorised');
    });
  });

  describe('releaseFunds', () => {
    it('releases successfully', async () => {
      const row = makeEscrowRow({ status: EscrowStatus.FUNDS_HELD });
      const releasedRow = { ...row, status: EscrowStatus.RELEASED };
      mockEscrowBuilder.single
        .mockResolvedValueOnce({ data: row, error: null })
        .mockResolvedValueOnce({ data: releasedRow, error: null });

      const result = await service.releaseFunds(PARTY_A, ESCROW_ID);
      expect(result.status).toBe(EscrowStatus.RELEASED);
    });

    it('throws when in wrong state', async () => {
      const row = makeEscrowRow({ status: EscrowStatus.AWAITING_DEPOSIT });
      mockEscrowBuilder.single.mockResolvedValue({ data: row, error: null });

      await expect(service.releaseFunds(PARTY_A, ESCROW_ID))
        .rejects.toThrow(EscrowInvalidStateException);
    });
  });

  describe('openDispute', () => {
    it('opens dispute successfully', async () => {
      const row = makeEscrowRow({ status: EscrowStatus.FUNDS_HELD });
      const disputedRow = { ...row, status: EscrowStatus.DISPUTED, dispute_reason: 'Not delivered' };
      mockEscrowBuilder.single
        .mockResolvedValueOnce({ data: row, error: null })
        .mockResolvedValueOnce({ data: disputedRow, error: null });

      const result = await service.openDispute(PARTY_A, ESCROW_ID, 'Not delivered');
      expect(result.status).toBe(EscrowStatus.DISPUTED);
    });

    it('throws when already disputed', async () => {
      const row = makeEscrowRow({ status: EscrowStatus.DISPUTED });
      mockEscrowBuilder.single.mockResolvedValue({ data: row, error: null });

      await expect(service.openDispute(PARTY_A, ESCROW_ID, 'Again'))
        .rejects.toThrow(EscrowAlreadyDisputedException);
    });
  });

  describe('resolveDispute', () => {
    it('resolves to release to party B', async () => {
      const row = makeEscrowRow({ status: EscrowStatus.DISPUTED });
      const resolvedRow = { ...row, status: EscrowStatus.RELEASED };
      mockEscrowBuilder.single
        .mockResolvedValueOnce({ data: row, error: null })
        .mockResolvedValueOnce({ data: resolvedRow, error: null });

      const result = await service.resolveDispute(ESCROW_ID, 'release_to_party_b', 'OK');
      expect(result.status).toBe(EscrowStatus.RELEASED);
    });

    it('resolves to refund to party A', async () => {
      const row = makeEscrowRow({ status: EscrowStatus.DISPUTED });
      const refundedRow = { ...row, status: EscrowStatus.REFUNDED };
      mockEscrowBuilder.single
        .mockResolvedValueOnce({ data: row, error: null })
        .mockResolvedValueOnce({ data: refundedRow, error: null });

      const result = await service.resolveDispute(ESCROW_ID, 'refund_to_party_a');
      expect(result.status).toBe(EscrowStatus.REFUNDED);
    });
  });

  describe('cancelEscrow', () => {
    it('cancels successfully', async () => {
      const row = makeEscrowRow({ status: EscrowStatus.AWAITING_DEPOSIT });
      const cancelledRow = { ...row, status: EscrowStatus.CANCELLED };
      mockEscrowBuilder.single
        .mockResolvedValueOnce({ data: row, error: null })
        .mockResolvedValueOnce({ data: cancelledRow, error: null });

      const result = await service.cancelEscrow(PARTY_A, ESCROW_ID, 'Changed mind');
      expect(result.status).toBe(EscrowStatus.CANCELLED);
    });
  });

  describe('getEscrow', () => {
    it('returns escrow for authorised party', async () => {
      const row = makeEscrowRow();
      mockEscrowBuilder.single.mockResolvedValue({ data: row, error: null });

      const result = await service.getEscrow(PARTY_A, ESCROW_ID);
      expect(result.id).toBe(ESCROW_ID);
    });

    it('throws EscrowNotFoundException for missing', async () => {
      mockEscrowBuilder.single.mockResolvedValue({ data: null, error: { message: 'not found' } });
      await expect(service.getEscrow(PARTY_A, 'missing'))
        .rejects.toThrow(EscrowNotFoundException);
    });
  });

  describe('listUserEscrows', () => {
    it('returns user escrows', async () => {
      const rows = [makeEscrowRow(), makeEscrowRow({ id: 'another-id' })];
      mockEscrowBuilder.order.mockResolvedValue({ data: rows, error: null });

      const result = await service.listUserEscrows(PARTY_A);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(ESCROW_ID);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';

describe('EscrowService', () => {
  let service: EscrowService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        {
          provide: 'PinoLogger:EscrowService',
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getProfile: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    service = module.get<EscrowService>(EscrowService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // -- createEscrow ---------------------------------------------------

  describe('createEscrow', () => {
    it('should create a pending escrow and deduct coins from sender', async () => {
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'partner-1' },
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { coins_balance: 500 },
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'escrow-1',
          sender_id: 'sender-1',
          receiver_id: 'partner-1',
          amount: 200,
          status: 'pending',
          description: 'Lesson payment',
          service_type: 'lesson',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        error: null,
      });

      const result = await service.createEscrow('sender-1', {
        partner_id: 'partner-1',
        amount: 200,
        description: 'Lesson payment',
        service_type: 'lesson',
      });

      expect(result).toEqual({
        id: 'escrow-1',
        status: 'pending',
        amount_held: 200,
        coins_remaining: 300,
      });
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        coins_balance: 300,
      });
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        sender_id: 'sender-1',
        receiver_id: 'partner-1',
        amount: 200,
        status: 'pending',
        description: 'Lesson payment',
        service_type: 'lesson',
      });
    });

    it('should truncate description longer than 500 characters', async () => {
      const longDescription = 'A'.repeat(600);

      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'partner-1' },
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { coins_balance: 500 },
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'escrow-1',
          sender_id: 'sender-1',
          receiver_id: 'partner-1',
          amount: 200,
          status: 'pending',
          description: 'A'.repeat(500),
          service_type: 'other',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        error: null,
      });

      await service.createEscrow('sender-1', {
        partner_id: 'partner-1',
        amount: 200,
        description: longDescription,
      });

      const insertCall = mockQueryBuilder.insert.mock.calls[0][0];
      expect(insertCall.description.length).toBe(500);
    });

    it('should default service_type to "other" when not provided', async () => {
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'partner-1' },
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { coins_balance: 100 },
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'escrow-2',
          sender_id: 'sender-1',
          receiver_id: 'partner-1',
          amount: 50,
          status: 'pending',
          description: 'General',
          service_type: 'other',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        error: null,
      });

      const result = await service.createEscrow('sender-1', {
        partner_id: 'partner-1',
        amount: 50,
        description: 'General',
      });

      expect(result.status).toBe('pending');
      expect(result.amount_held).toBe(50);
      expect(result.coins_remaining).toBe(50);
    });

    it('should throw BadRequestException when sender and partner are the same', async () => {
      await expect(
        service.createEscrow('user-1', {
          partner_id: 'user-1',
          amount: 100,
          description: 'Self escrow',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when partner does not exist', async () => {
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await expect(
        service.createEscrow('sender-1', {
          partner_id: 'nonexistent',
          amount: 100,
          description: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when sender has insufficient coins', async () => {
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'partner-1' },
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { coins_balance: 30 },
        error: null,
      });

      await expect(
        service.createEscrow('sender-1', {
          partner_id: 'partner-1',
          amount: 100,
          description: 'Too expensive',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should rollback coin deduction when escrow insert fails', async () => {
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'partner-1' },
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { coins_balance: 500 },
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Insert failed' },
      });

      await expect(
        service.createEscrow('sender-1', {
          partner_id: 'partner-1',
          amount: 200,
          description: 'Test',
        }),
      ).rejects.toThrow('Failed to create escrow record.');

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        coins_balance: 500,
      });
    });
  });

  // -- releaseEscrow --------------------------------------------------

  describe('releaseEscrow', () => {
    const escrowRecord = {
      id: 'escrow-1',
      sender_id: 'sender-1',
      receiver_id: 'receiver-1',
      amount: 200,
      status: 'pending',
      description: 'Lesson',
      service_type: 'lesson',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    it('should release funds to receiver and update escrow status', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: escrowRecord,
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { coins_balance: 100 },
        error: null,
      });

      const result = await service.releaseEscrow('sender-1', {
        escrow_id: 'escrow-1',
      });

      expect(result).toEqual({
        id: 'escrow-1',
        status: 'released',
        amount_released: 200,
        receiver_new_balance: 300,
      });
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        coins_balance: 300,
      });
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        status: 'released',
      });
    });

    it('should throw NotFoundException when escrow does not exist', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      await expect(
        service.releaseEscrow('sender-1', { escrow_id: 'nonexistent' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when escrow is already released', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { ...escrowRecord, status: 'released' },
        error: null,
      });

      await expect(
        service.releaseEscrow('sender-1', { escrow_id: 'escrow-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when escrow is disputed', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { ...escrowRecord, status: 'disputed' },
        error: null,
      });

      await expect(
        service.releaseEscrow('sender-1', { escrow_id: 'escrow-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when escrow is already refunded', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { ...escrowRecord, status: 'refunded' },
        error: null,
      });

      await expect(
        service.releaseEscrow('sender-1', { escrow_id: 'escrow-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when caller is not the sender', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: escrowRecord,
        error: null,
      });

      await expect(
        service.releaseEscrow('receiver-1', { escrow_id: 'escrow-1' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // -- refundEscrow ---------------------------------------------------

  describe('refundEscrow', () => {
    const escrowRecord = {
      id: 'escrow-1',
      sender_id: 'sender-1',
      receiver_id: 'receiver-1',
      amount: 150,
      status: 'pending',
      description: 'Translation',
      service_type: 'translation',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    it('should refund coins to sender and update escrow status', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: escrowRecord,
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { coins_balance: 50 },
        error: null,
      });

      const result = await service.refundEscrow('sender-1', {
        escrow_id: 'escrow-1',
        reason: 'Service not delivered',
      });

      expect(result).toEqual({
        id: 'escrow-1',
        status: 'refunded',
        amount_refunded: 150,
        sender_new_balance: 200,
      });
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        coins_balance: 200,
      });
    });

    it('should truncate long refund reason', async () => {
      const longReason = 'B'.repeat(2000);

      mockQueryBuilder.single.mockResolvedValueOnce({
        data: escrowRecord,
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { coins_balance: 10 },
        error: null,
      });

      await service.refundEscrow('sender-1', {
        escrow_id: 'escrow-1',
        reason: longReason,
      });

      const updateCalls = mockQueryBuilder.update.mock.calls;
      const escrowUpdateCall = updateCalls.find(
        ([arg]: [Record<string, unknown>]) =>
          typeof arg === 'object' && 'dispute_reason' in arg,
      );
      expect(escrowUpdateCall[0].dispute_reason.length).toBe(1000);
    });

    it('should allow refund without providing a reason', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: escrowRecord,
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { coins_balance: 10 },
        error: null,
      });

      const result = await service.refundEscrow('sender-1', {
        escrow_id: 'escrow-1',
      });

      expect(result.status).toBe('refunded');
      expect(result.amount_refunded).toBe(150);
      expect(result.sender_new_balance).toBe(160);
    });

    it('should throw NotFoundException when escrow does not exist', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await expect(
        service.refundEscrow('sender-1', { escrow_id: 'nonexistent' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when escrow is already refunded', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { ...escrowRecord, status: 'refunded' },
        error: null,
      });

      await expect(
        service.refundEscrow('sender-1', { escrow_id: 'escrow-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when escrow is already released', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { ...escrowRecord, status: 'released' },
        error: null,
      });

      await expect(
        service.refundEscrow('sender-1', { escrow_id: 'escrow-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when caller is not the sender', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: escrowRecord,
        error: null,
      });

      await expect(
        service.refundEscrow('receiver-1', { escrow_id: 'escrow-1' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // -- disputeEscrow --------------------------------------------------

  describe('disputeEscrow', () => {
    const escrowRecord = {
      id: 'escrow-1',
      sender_id: 'sender-1',
      receiver_id: 'receiver-1',
      amount: 200,
      status: 'pending',
      description: 'Service',
      service_type: 'other',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    it('should allow sender to dispute a pending escrow', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: escrowRecord,
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          ...escrowRecord,
          status: 'disputed',
          dispute_reason: 'Service not provided',
        },
        error: null,
      });

      const result = await service.disputeEscrow('sender-1', {
        escrow_id: 'escrow-1',
        reason: 'Service not provided',
      });

      expect(result.status).toBe('disputed');
      expect(result.dispute_reason).toBe('Service not provided');
    });

    it('should allow receiver to dispute a pending escrow', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: escrowRecord,
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          ...escrowRecord,
          status: 'disputed',
          dispute_reason: 'Sender cancelled after work done',
          dispute_evidence: 'Screenshots',
        },
        error: null,
      });

      const result = await service.disputeEscrow('receiver-1', {
        escrow_id: 'escrow-1',
        reason: 'Sender cancelled after work done',
        evidence: 'Screenshots',
      });

      expect(result.status).toBe('disputed');
      expect(result.dispute_evidence).toBe('Screenshots');
    });

    it('should truncate long dispute reason and evidence', async () => {
      const longReason = 'C'.repeat(2000);
      const longEvidence = 'D'.repeat(10000);

      mockQueryBuilder.single.mockResolvedValueOnce({
        data: escrowRecord,
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          ...escrowRecord,
          status: 'disputed',
          dispute_reason: 'C'.repeat(1000),
          dispute_evidence: 'D'.repeat(5000),
        },
        error: null,
      });

      await service.disputeEscrow('sender-1', {
        escrow_id: 'escrow-1',
        reason: longReason,
        evidence: longEvidence,
      });

      const updateCall = mockQueryBuilder.update.mock.calls.find(
        ([arg]: [Record<string, unknown>]) =>
          typeof arg === 'object' && 'dispute_reason' in arg,
      );
      expect(updateCall[0].dispute_reason.length).toBe(1000);
      expect(updateCall[0].dispute_evidence.length).toBe(5000);
    });

    it('should throw NotFoundException when escrow does not exist', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await expect(
        service.disputeEscrow('sender-1', {
          escrow_id: 'nonexistent',
          reason: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when escrow is already released', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { ...escrowRecord, status: 'released' },
        error: null,
      });

      await expect(
        service.disputeEscrow('sender-1', {
          escrow_id: 'escrow-1',
          reason: 'Late dispute',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when escrow is already disputed', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { ...escrowRecord, status: 'disputed' },
        error: null,
      });

      await expect(
        service.disputeEscrow('sender-1', {
          escrow_id: 'escrow-1',
          reason: 'Double dispute',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when caller is not a participant', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: escrowRecord,
        error: null,
      });

      await expect(
        service.disputeEscrow('stranger-1', {
          escrow_id: 'escrow-1',
          reason: 'Not my escrow',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // -- resolveDispute -------------------------------------------------

  describe('resolveDispute', () => {
    const disputedRecord = {
      id: 'escrow-1',
      sender_id: 'sender-1',
      receiver_id: 'receiver-1',
      amount: 200,
      status: 'disputed',
      description: 'Service',
      service_type: 'other',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    it('should resolve dispute by releasing to receiver', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: disputedRecord,
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { coins_balance: 100 },
        error: null,
      });

      const result = await service.resolveDispute('admin-1', {
        escrow_id: 'escrow-1',
        resolution: 'release',
        admin_note: 'Evidence supports receiver',
      });

      expect(result).toEqual({
        id: 'escrow-1',
        status: 'released',
        amount_released: 200,
        receiver_new_balance: 300,
      });
    });

    it('should resolve dispute by refunding to sender', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: disputedRecord,
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { coins_balance: 50 },
        error: null,
      });

      const result = await service.resolveDispute('admin-1', {
        escrow_id: 'escrow-1',
        resolution: 'refund',
      });

      expect(result).toEqual({
        id: 'escrow-1',
        status: 'refunded',
        amount_refunded: 200,
        sender_new_balance: 250,
      });
    });

    it('should truncate long admin_note', async () => {
      const longNote = 'E'.repeat(5000);

      mockQueryBuilder.single.mockResolvedValueOnce({
        data: disputedRecord,
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { coins_balance: 100 },
        error: null,
      });

      await service.resolveDispute('admin-1', {
        escrow_id: 'escrow-1',
        resolution: 'release',
        admin_note: longNote,
      });

      const updateCall = mockQueryBuilder.update.mock.calls.find(
        ([arg]: [Record<string, unknown>]) =>
          typeof arg === 'object' && 'admin_note' in arg,
      );
      expect(updateCall[0].admin_note.length).toBe(2000);
    });

    it('should throw NotFoundException when escrow does not exist', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await expect(
        service.resolveDispute('admin-1', {
          escrow_id: 'nonexistent',
          resolution: 'release',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when escrow is not disputed', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { ...disputedRecord, status: 'pending' },
        error: null,
      });

      await expect(
        service.resolveDispute('admin-1', {
          escrow_id: 'escrow-1',
          resolution: 'release',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -- getEscrow ------------------------------------------------------

  describe('getEscrow', () => {
    it('should return escrow by id', async () => {
      const record = {
        id: 'escrow-1',
        sender_id: 'sender-1',
        receiver_id: 'receiver-1',
        amount: 100,
        status: 'pending',
        description: 'Test',
        service_type: 'lesson',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: record,
        error: null,
      });

      const result = await service.getEscrow('escrow-1');
      expect(result).toEqual(record);
    });

    it('should throw NotFoundException when escrow does not exist', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await expect(service.getEscrow('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -- listUserEscrows ------------------------------------------------

  describe('listUserEscrows', () => {
    function setupCountMock(count: number) {
      const countBuilder = {
        ...mockQueryBuilder,
        count,
        error: null,
      };
      mockQueryBuilder.or.mockReturnValueOnce(countBuilder);
    }

    function setupDataMock(data: unknown) {
      mockQueryBuilder.or.mockReturnValueOnce(mockQueryBuilder);
      mockQueryBuilder.order.mockReturnValueOnce(mockQueryBuilder);
      mockQueryBuilder.range.mockReturnValueOnce({ data, error: null });
    }

    it('should return paginated escrows with summary rows (default pagination)', async () => {
      const summaryRows = [
        {
          id: 'escrow-1',
          sender_id: 'user-1',
          receiver_id: 'partner-1',
          amount: 100,
          status: 'pending',
          description: 'Test',
          service_type: 'lesson',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];

      setupCountMock(1);
      setupDataMock(summaryRows);

      const result = await service.listUserEscrows('user-1', {});

      expect(result).toEqual({
        data: summaryRows,
        total: 1,
        limit: 20,
        offset: 0,
      });
    });

    it('should honour custom limit and offset', async () => {
      const summaryRows = [
        {
          id: 'escrow-2',
          sender_id: 'user-1',
          receiver_id: 'partner-2',
          amount: 50,
          status: 'released',
          description: 'Second page',
          service_type: 'other',
          created_at: '2026-01-02T00:00:00Z',
          updated_at: '2026-01-02T00:00:00Z',
        },
      ];

      setupCountMock(5);
      setupDataMock(summaryRows);

      const result = await service.listUserEscrows('user-1', {
        limit: 10,
        offset: 5,
      });

      expect(result.limit).toBe(10);
      expect(result.offset).toBe(5);
      expect(result.total).toBe(5);
      expect(result.data).toEqual(summaryRows);

      expect(mockQueryBuilder.range).toHaveBeenCalledWith(5, 14);
    });

    it('should filter by status when provided', async () => {
      setupCountMock(1);
      setupDataMock([]);

      await service.listUserEscrows('user-1', { status: 'pending' });

      const eqCalls = mockQueryBuilder.eq.mock.calls;
      expect(eqCalls.some((call: string[]) => call[0] === 'status')).toBe(true);
    });

    it('should throw BadRequestException for invalid status filter', async () => {
      await expect(
        service.listUserEscrows('user-1', { status: 'invalid' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle empty result set gracefully', async () => {
      setupCountMock(0);
      setupDataMock(null);

      const result = await service.listUserEscrows('user-1', {});

      expect(result).toEqual({
        data: [],
        total: 0,
        limit: 20,
        offset: 0,
      });
    });

    it('should filter out malformed rows from data', async () => {
      setupCountMock(2);
      setupDataMock([
        {
          id: 'escrow-1',
          sender_id: 'user-1',
          receiver_id: 'partner-1',
          amount: 100,
          status: 'pending',
          description: 'Good',
          service_type: 'lesson',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        { id: 'bad', status: 'broken' },
      ]);

      const result = await service.listUserEscrows('user-1', {});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('escrow-1');
      expect(result.total).toBe(2);
    });
  });
});

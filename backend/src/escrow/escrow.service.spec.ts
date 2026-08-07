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

  // ── createEscrow ────────────────────────────────────────────

  describe('createEscrow', () => {
    it('should create a pending escrow and deduct coins from sender', async () => {
      // Receiver check
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'partner-1' },
        error: null,
      });
      // Sender balance check
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { coins_balance: 500 },
        error: null,
      });
      // Insert escrow
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
      // Insert fails with data that is not valid escrow row
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

      // Should have rolled back the deduction
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        coins_balance: 500,
      });
    });
  });

  // ── releaseEscrow ───────────────────────────────────────────

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

  // ── refundEscrow ────────────────────────────────────────────

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

  // ── disputeEscrow ───────────────────────────────────────────

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
        service.disputeEscrow('random-user', {
          escrow_id: 'escrow-1',
          reason: 'Not involved',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── resolveDispute ──────────────────────────────────────────

  describe('resolveDispute', () => {
    const disputedEscrow = {
      id: 'escrow-1',
      sender_id: 'sender-1',
      receiver_id: 'receiver-1',
      amount: 200,
      status: 'disputed',
      description: 'Lesson',
      service_type: 'lesson',
      dispute_reason: 'Service not delivered',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    it('should resolve dispute by releasing funds to receiver', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: disputedEscrow,
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { coins_balance: 50 },
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
        receiver_new_balance: 250,
      });
    });

    it('should resolve dispute by refunding sender', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: disputedEscrow,
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { coins_balance: 10 },
        error: null,
      });

      const result = await service.resolveDispute('admin-1', {
        escrow_id: 'escrow-1',
        resolution: 'refund',
        admin_note: 'Refund warranted',
      });

      expect(result).toEqual({
        id: 'escrow-1',
        status: 'refunded',
        amount_refunded: 200,
        sender_new_balance: 210,
      });
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
        data: { ...disputedEscrow, status: 'pending' },
        error: null,
      });

      await expect(
        service.resolveDispute('admin-1', {
          escrow_id: 'escrow-1',
          resolution: 'release',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when escrow is already released', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { ...disputedEscrow, status: 'released' },
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

  // ── getEscrow ───────────────────────────────────────────────

  describe('getEscrow', () => {
    it('should return escrow by id', async () => {
      const escrow = {
        id: 'escrow-1',
        sender_id: 'sender-1',
        receiver_id: 'receiver-1',
        amount: 150,
        status: 'pending',
        description: 'Test',
        service_type: 'lesson',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: escrow,
        error: null,
      });

      const result = await service.getEscrow('escrow-1');

      expect(result).toEqual(escrow);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('escrows');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'escrow-1');
    });

    it('should throw NotFoundException when escrow not found', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await expect(service.getEscrow('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── listUserEscrows ─────────────────────────────────────────

  describe('listUserEscrows', () => {
    const mockEscrows = [
      {
        id: 'escrow-1',
        sender_id: 'user-1',
        receiver_id: 'partner-1',
        amount: 100,
        status: 'pending',
        description: 'Lesson',
        service_type: 'lesson',
        created_at: '2026-01-02T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
      },
      {
        id: 'escrow-2',
        sender_id: 'partner-2',
        receiver_id: 'user-1',
        amount: 50,
        status: 'released',
        description: 'Correction',
        service_type: 'proofreading',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];

    it('should list all escrows for a user (both sent and received)', async () => {
      const mockQueryAfterOr = {
        ...mockQueryBuilder,
        order: jest.fn().mockResolvedValue({ data: mockEscrows, error: null }),
      };
      mockQueryBuilder.or = jest.fn().mockReturnValue(mockQueryAfterOr);

      const result = await service.listUserEscrows('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('escrow-1');
      expect(result[1].id).toBe('escrow-2');
      expect(mockQueryBuilder.or).toHaveBeenCalledWith(
        'sender_id.eq.user-1,receiver_id.eq.user-1',
      );
    });

    it('should filter by status when provided', async () => {
      const filtered = [mockEscrows[0]];
      // Chain: from -> select -> or -> order -> eq -> await
      // .or() must return something with .order()
      // .order() must return something with .eq()
      // .eq() resolves with data
      const mockEq = jest
        .fn()
        .mockResolvedValue({ data: filtered, error: null });
      const mockAfterOrder = { eq: mockEq };
      const mockQueryAfterOr = {
        order: jest.fn().mockReturnValue(mockAfterOrder),
      };
      mockQueryBuilder.or = jest.fn().mockReturnValue(mockQueryAfterOr);

      const result = await service.listUserEscrows('user-1', 'pending');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
      expect(mockEq).toHaveBeenCalledWith('status', 'pending');
    });

    it('should throw BadRequestException for invalid status filter', async () => {
      await expect(
        service.listUserEscrows('user-1', 'invalid-status'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return empty array when user has no escrows', async () => {
      const mockQueryAfterOr = {
        ...mockQueryBuilder,
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
      mockQueryBuilder.or = jest.fn().mockReturnValue(mockQueryAfterOr);

      const result = await service.listUserEscrows('user-1');

      expect(result).toEqual([]);
    });
  });
});

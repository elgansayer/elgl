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

describe('EscrowService', () => {
  let service: EscrowService;
  let monetisationService: MonetisationService;
  let mockQueryBuilder: any;
  let module: TestingModule;

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
          },
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

    it('should refund coins if escrow insert fails', async () => {
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

    it('should release escrow successfully', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: heldEscrow,
        error: null,
      });
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

    it('should refund escrow successfully', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: heldEscrow,
        error: null,
      });
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

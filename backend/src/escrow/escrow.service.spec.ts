import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('EscrowService', () => {
  let service: EscrowService;
  let supabaseClient: {
    from: ReturnType<typeof jest.fn>;
  };

  beforeEach(async () => {
    supabaseClient = {
      from: jest.fn().mockReturnThis(),
    };

    const mockSupabase = {
      client: supabaseClient,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();

    service = module.get<EscrowService>(EscrowService);
  });

  describe('createPayment', () => {
    it('should throw if payer and payee are the same', async () => {
      await expect(
        service.createPayment('user-1', { payee_id: 'user-1', amount_coins: 100, description: 'Test' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a payment successfully', async () => {
      const mockPayment = {
        id: 'escrow-1',
        payer_id: 'user-1',
        payee_id: 'user-2',
        amount_coins: 100,
        description: 'Test payment',
        status: 'pending',
      };

      const mockChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockPayment, error: null }),
      };

      supabaseClient.from = jest.fn().mockReturnValue(mockChain);

      const result = await service.createPayment('user-1', {
        payee_id: 'user-2',
        amount_coins: 100,
        description: 'Test payment',
      });

      expect(result.status).toBe('pending');
      expect(result.payer_id).toBe('user-1');
    });
  });

  describe('getPayment', () => {
    it('should throw NotFoundException when payment not found', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      };

      supabaseClient.from = jest.fn().mockReturnValue(mockChain);

      await expect(service.getPayment('escrow-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should return payment for authorised user', async () => {
      const mockPayment = { id: 'escrow-1', payer_id: 'user-1', payee_id: 'user-2' };
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockPayment, error: null }),
      };

      supabaseClient.from = jest.fn().mockReturnValue(mockChain);

      const result = await service.getPayment('escrow-1', 'user-1');
      expect(result.id).toBe('escrow-1');
    });
  });

  describe('fundPayment', () => {
    it('should throw if status is not pending', async () => {
      // First getPayment call returns funded payment
      const fundedPayment = { id: 'escrow-1', payer_id: 'user-1', payee_id: 'user-2', status: 'funded' };
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: fundedPayment, error: null }),
      };

      supabaseClient.from = jest.fn().mockReturnValue(mockChain);

      await expect(service.fundPayment('escrow-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('completePayment', () => {
    it('should throw if status is not delivered', async () => {
      const fundedPayment = { id: 'escrow-1', payer_id: 'user-1', payee_id: 'user-2', status: 'funded' };
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: fundedPayment, error: null }),
      };

      supabaseClient.from = jest.fn().mockReturnValue(mockChain);

      await expect(service.completePayment('escrow-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelPayment', () => {
    it('should cancel a pending payment', async () => {
      const pendingPayment = { id: 'escrow-1', payer_id: 'user-1', payee_id: 'user-2', status: 'pending' };
      const cancelledPayment = { ...pendingPayment, status: 'cancelled' };

      // First call: getPayment
      let callCount = 0;
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        single: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({ data: pendingPayment, error: null });
          }
          return Promise.resolve({ data: cancelledPayment, error: null });
        }),
        update: jest.fn().mockReturnThis(),
      };

      supabaseClient.from = jest.fn().mockReturnValue(mockChain);

      const result = await service.cancelPayment('escrow-1', 'user-1');
      expect(result.status).toBe('cancelled');
    });
  });
});
import { Test, TestingModule } from '@nestjs/testing';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';
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
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<EscrowController>(EscrowController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

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

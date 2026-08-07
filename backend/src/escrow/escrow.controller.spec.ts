import { Test, TestingModule } from '@nestjs/testing';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';
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

describe('EscrowController', () => {
  let controller: EscrowController;
  let escrowService: EscrowService;

  beforeEach(async () => {
>>>>>>> origin/main
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EscrowController],
      providers: [
        {
          provide: EscrowService,
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
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
<<<<<<< HEAD
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<EscrowController>(EscrowController);
=======
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<EscrowController>(EscrowController);
    escrowService = module.get<EscrowService>(EscrowService);
  });

  afterEach(() => {
    jest.clearAllMocks();
>>>>>>> origin/main
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

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

    it('should call service createEscrow with user ID and DTO', async () => {
      const dto = { payee_id: 'payee-1', amount_coins: 100 };
      const result = { id: 'escrow-1', status: 'held', amount_coins: 100, payer_balance: 50 };
      (escrowService.createEscrow as jest.Mock).mockResolvedValue(result);

      const response = await controller.create({ user: { id: 'payer-1' } } as never, dto);

      expect(escrowService.createEscrow).toHaveBeenCalledWith('payer-1', dto);
      expect(response).toEqual(result);
    });
  });

  describe('release', () => {
    it('should throw UnauthorizedException if no user', async () => {
      await expect(
        controller.release({ user: undefined } as never, { escrow_id: 'escrow-1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should call service releaseEscrow with user ID and escrow ID', async () => {
      const dto = { escrow_id: 'escrow-1' };
      const result = { id: 'escrow-1', status: 'released', amount_coins: 100, payee_balance: 200 };
      (escrowService.releaseEscrow as jest.Mock).mockResolvedValue(result);

      const response = await controller.release({ user: { id: 'payer-1' } } as never, dto);

      expect(escrowService.releaseEscrow).toHaveBeenCalledWith('payer-1', 'escrow-1');
      expect(response).toEqual(result);
    });
  });

  describe('refund', () => {
    it('should throw UnauthorizedException if no user', async () => {
      await expect(
        controller.refund({ user: undefined } as never, { escrow_id: 'escrow-1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should call service refundEscrow with user ID and escrow ID', async () => {
      const dto = { escrow_id: 'escrow-1' };
      const result = { id: 'escrow-1', status: 'refunded', amount_coins: 100, payer_balance: 150 };
      (escrowService.refundEscrow as jest.Mock).mockResolvedValue(result);

      const response = await controller.refund({ user: { id: 'payer-1' } } as never, dto);

      expect(escrowService.refundEscrow).toHaveBeenCalledWith('payer-1', 'escrow-1');
      expect(response).toEqual(result);
    });
  });

  describe('list', () => {
    it('should throw UnauthorizedException if no user', async () => {
      await expect(
        controller.list({ user: undefined } as never, '10', '0'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should call service listEscrows with default pagination', async () => {
      const result = { escrows: [], total: 0 };
      (escrowService.listEscrows as jest.Mock).mockResolvedValue(result);

      const response = await controller.list({ user: { id: 'payer-1' } } as never);

      expect(escrowService.listEscrows).toHaveBeenCalledWith('payer-1', 20, 0);
      expect(response).toEqual(result);
    });

    it('should parse limit and offset query params', async () => {
      const result = { escrows: [], total: 0 };
      (escrowService.listEscrows as jest.Mock).mockResolvedValue(result);

      const response = await controller.list({ user: { id: 'payer-1' } } as never, '5', '10');

      expect(escrowService.listEscrows).toHaveBeenCalledWith('payer-1', 5, 10);
      expect(response).toEqual(result);
    });
  });

  describe('getById', () => {
    it('should throw UnauthorizedException if no user', async () => {
      await expect(
        controller.getById({ user: undefined } as never, 'escrow-1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should call service getEscrow with user ID and escrow ID', async () => {
      const result = { id: 'escrow-1', payer_id: 'payer-1', payee_id: 'payee-1', amount_coins: 50, status: 'held' };
      (escrowService.getEscrow as jest.Mock).mockResolvedValue(result);

      const response = await controller.getById({ user: { id: 'payer-1' } } as never, 'escrow-1');

      expect(escrowService.getEscrow).toHaveBeenCalledWith('payer-1', 'escrow-1');
      expect(response).toEqual(result);
    });
  });
});
>>>>>>> origin/main

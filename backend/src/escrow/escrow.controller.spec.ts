import { Test, TestingModule } from '@nestjs/testing';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('EscrowController', () => {
  let controller: EscrowController;
  let escrowService: EscrowService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EscrowController],
      providers: [
        {
          provide: EscrowService,
          useValue: {
            createEscrow: jest.fn(),
            releaseEscrow: jest.fn(),
            refundEscrow: jest.fn(),
            disputeEscrow: jest.fn(),
            resolveDispute: jest.fn(),
            getEscrow: jest.fn(),
            listUserEscrows: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<EscrowController>(EscrowController);
    escrowService = module.get<EscrowService>(EscrowService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createEscrow', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.createEscrow(null, {} as any);
      expect(result).toBeNull();
      expect(escrowService.createEscrow).not.toHaveBeenCalled();
    });

    it('should call service createEscrow when user is provided', async () => {
      const dto = {
        partner_id: 'partner-1',
        amount: 100,
        description: 'Lesson payment',
      };
      const response = {
        id: 'escrow-1',
        status: 'pending',
        amount_held: 100,
        coins_remaining: 200,
      };
      (escrowService.createEscrow as jest.Mock).mockResolvedValue(response);

      const result = await controller.createEscrow(
        { id: 'user-1' } as any,
        dto,
      );
      expect(escrowService.createEscrow).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(response);
    });
  });

  describe('releaseEscrow', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.releaseEscrow(null, {} as any);
      expect(result).toBeNull();
      expect(escrowService.releaseEscrow).not.toHaveBeenCalled();
    });

    it('should call service releaseEscrow when user is provided', async () => {
      const dto = { escrow_id: 'escrow-1' };
      const response = {
        id: 'escrow-1',
        status: 'released',
        amount_released: 100,
        receiver_new_balance: 350,
      };
      (escrowService.releaseEscrow as jest.Mock).mockResolvedValue(response);

      const result = await controller.releaseEscrow(
        { id: 'user-1' } as any,
        dto,
      );
      expect(escrowService.releaseEscrow).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(response);
    });
  });

  describe('refundEscrow', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.refundEscrow(null, {} as any);
      expect(result).toBeNull();
      expect(escrowService.refundEscrow).not.toHaveBeenCalled();
    });

    it('should call service refundEscrow when user is provided', async () => {
      const dto = { escrow_id: 'escrow-1', reason: 'Changed mind' };
      const response = {
        id: 'escrow-1',
        status: 'refunded',
        amount_refunded: 100,
        sender_new_balance: 300,
      };
      (escrowService.refundEscrow as jest.Mock).mockResolvedValue(response);

      const result = await controller.refundEscrow(
        { id: 'user-1' } as any,
        dto,
      );
      expect(escrowService.refundEscrow).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(response);
    });
  });

  describe('disputeEscrow', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.disputeEscrow(null, {} as any);
      expect(result).toBeNull();
      expect(escrowService.disputeEscrow).not.toHaveBeenCalled();
    });

    it('should call service disputeEscrow when user is provided', async () => {
      const dto = {
        escrow_id: 'escrow-1',
        reason: 'Service not delivered',
      };
      const response = {
        id: 'escrow-1',
        sender_id: 'sender-1',
        receiver_id: 'receiver-1',
        amount: 100,
        status: 'disputed',
        description: 'Lesson payment',
        service_type: 'lesson',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      };
      (escrowService.disputeEscrow as jest.Mock).mockResolvedValue(response);

      const result = await controller.disputeEscrow(
        { id: 'receiver-1' } as any,
        dto,
      );
      expect(escrowService.disputeEscrow).toHaveBeenCalledWith(
        'receiver-1',
        dto,
      );
      expect(result).toEqual(response);
    });
  });

  describe('resolveDispute', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.resolveDispute(null, {} as any);
      expect(result).toBeNull();
      expect(escrowService.resolveDispute).not.toHaveBeenCalled();
    });

    it('should call service resolveDispute when user is provided', async () => {
      const dto = {
        escrow_id: 'escrow-1',
        resolution: 'release' as const,
        admin_note: 'Reviewed evidence',
      };
      const response = {
        id: 'escrow-1',
        status: 'released',
        amount_released: 100,
        receiver_new_balance: 400,
      };
      (escrowService.resolveDispute as jest.Mock).mockResolvedValue(response);

      const result = await controller.resolveDispute(
        { id: 'admin-1' } as any,
        dto,
      );
      expect(escrowService.resolveDispute).toHaveBeenCalledWith('admin-1', dto);
      expect(result).toEqual(response);
    });
  });

  describe('getEscrow', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.getEscrow(null, 'escrow-1');
      expect(result).toBeNull();
      expect(escrowService.getEscrow).not.toHaveBeenCalled();
    });

    it('should call service getEscrow when user is provided', async () => {
      const response = {
        id: 'escrow-1',
        sender_id: 'sender-1',
        receiver_id: 'receiver-1',
        amount: 100,
        status: 'pending',
        description: 'Test',
        service_type: 'lesson',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      };
      (escrowService.getEscrow as jest.Mock).mockResolvedValue(response);

      const result = await controller.getEscrow(
        { id: 'user-1' } as any,
        'escrow-1',
      );
      expect(escrowService.getEscrow).toHaveBeenCalledWith('escrow-1');
      expect(result).toEqual(response);
    });
  });

  describe('listEscrows', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.listEscrows(null, {});
      expect(result).toBeNull();
      expect(escrowService.listUserEscrows).not.toHaveBeenCalled();
    });

    it('should call service listUserEscrows when user is provided', async () => {
      const response = {
        data: [
          {
            id: 'escrow-1',
            sender_id: 'user-1',
            receiver_id: 'receiver-1',
            amount: 100,
            status: 'pending',
            description: 'Test',
            service_type: 'lesson',
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      };
      (escrowService.listUserEscrows as jest.Mock).mockResolvedValue(response);

      const dto = { status: 'pending' };
      const result = await controller.listEscrows(
        { id: 'user-1' } as any,
        dto,
      );
      expect(escrowService.listUserEscrows).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(response);
    });

    it('should call service listUserEscrows with empty dto when none provided', async () => {
      const response = { data: [], total: 0, limit: 20, offset: 0 };
      (escrowService.listUserEscrows as jest.Mock).mockResolvedValue(response);

      await controller.listEscrows({ id: 'user-1' } as any, {});
      expect(escrowService.listUserEscrows).toHaveBeenCalledWith('user-1', {});
    });
  });
});

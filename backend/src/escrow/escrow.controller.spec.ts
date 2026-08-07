import { Test, TestingModule } from '@nestjs/testing';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { UnauthorizedException } from '@nestjs/common';

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
            getEscrow: jest.fn(),
            listEscrows: jest.fn(),
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
import { EscrowPaymentsController } from './escrow-payments.controller';
import { EscrowPaymentsService } from './escrow-payments.service';
import { EscrowStatus } from './dto/escrow.dto';

describe('EscrowPaymentsController', () => {
  let controller: EscrowPaymentsController;
  let mockService: Record<string, jest.Mock>;

  const PARTY_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const PARTY_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const ESCROW_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

  const mockUser = { id: PARTY_A, email: 'a@test.com' };

  beforeEach(() => {
    mockService = {
      createEscrow: jest.fn(),
      depositFunds: jest.fn(),
      releaseFunds: jest.fn(),
      openDispute: jest.fn(),
      resolveDispute: jest.fn(),
      cancelEscrow: jest.fn(),
      getEscrow: jest.fn(),
      listUserEscrows: jest.fn(),
    };

    // Instantiate directly to avoid NestJS DI resolving @UseFilters
    controller = new EscrowPaymentsController(
      mockService as unknown as EscrowPaymentsService,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createEscrow', () => {
    it('calls service.createEscrow with user ID and DTO', async () => {
      const dto = { partyBId: PARTY_B, amount: 100, currency: 'coins' };
      const expected = {
        id: ESCROW_ID,
        partyAId: PARTY_A,
        partyBId: PARTY_B,
        amount: 100,
        currency: 'coins',
        status: EscrowStatus.AWAITING_DEPOSIT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };
      mockService.createEscrow.mockResolvedValue(expected);

      const result = await controller.createEscrow(mockUser as never, dto);
      expect(mockService.createEscrow).toHaveBeenCalledWith(PARTY_A, dto);
      expect(result).toEqual(expected);
    });
  });

  describe('depositFunds', () => {
    it('calls service.depositFunds', async () => {
      const expected = {
        id: ESCROW_ID,
        partyAId: PARTY_A,
        partyBId: PARTY_B,
        amount: 100,
        currency: 'coins',
        status: EscrowStatus.FUNDS_HELD,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };
      mockService.depositFunds.mockResolvedValue(expected);

      const result = await controller.depositFunds(mockUser as never, {
        escrowId: ESCROW_ID,
      });
      expect(mockService.depositFunds).toHaveBeenCalledWith(PARTY_A, ESCROW_ID);
      expect(result).toEqual(expected);
    });
  });

  describe('releaseFunds', () => {
    it('calls service.releaseFunds', async () => {
      mockService.releaseFunds.mockResolvedValue({});
      await controller.releaseFunds(mockUser as never, { escrowId: ESCROW_ID });
      expect(mockService.releaseFunds).toHaveBeenCalledWith(PARTY_A, ESCROW_ID);
    });
  });

  describe('openDispute', () => {
    it('calls service.openDispute with reason', async () => {
      mockService.openDispute.mockResolvedValue({});
      await controller.openDispute(mockUser as never, {
        escrowId: ESCROW_ID,
        reason: 'Not received',
      });
      expect(mockService.openDispute).toHaveBeenCalledWith(PARTY_A, ESCROW_ID, 'Not received');
    });
  });

  describe('resolveDispute', () => {
    it('calls service.resolveDispute', async () => {
      mockService.resolveDispute.mockResolvedValue({});
      await controller.resolveDispute(mockUser as never, {
        escrowId: ESCROW_ID,
        resolution: 'release_to_party_b',
        adminNotes: 'OK',
      });
      expect(mockService.resolveDispute).toHaveBeenCalledWith(ESCROW_ID, 'release_to_party_b', 'OK');
    });
  });

  describe('cancelEscrow', () => {
    it('calls service.cancelEscrow', async () => {
      mockService.cancelEscrow.mockResolvedValue({});
      await controller.cancelEscrow(mockUser as never, {
        escrowId: ESCROW_ID,
        reason: 'Changed mind',
      });
      expect(mockService.cancelEscrow).toHaveBeenCalledWith(PARTY_A, ESCROW_ID, 'Changed mind');
    });
  });

  describe('getEscrow', () => {
    it('calls service.getEscrow', async () => {
      mockService.getEscrow.mockResolvedValue({});
      await controller.getEscrow(mockUser as never, ESCROW_ID);
      expect(mockService.getEscrow).toHaveBeenCalledWith(PARTY_A, ESCROW_ID);
    });
  });

  describe('listEscrows', () => {
    it('calls service.listUserEscrows', async () => {
      mockService.listUserEscrows.mockResolvedValue([]);
      await controller.listEscrows(mockUser as never);
      expect(mockService.listUserEscrows).toHaveBeenCalledWith(PARTY_A);
    });
  });
});
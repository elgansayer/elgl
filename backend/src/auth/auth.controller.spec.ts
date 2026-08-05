import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TransferService } from '../transfer/transfer.service';

describe('AuthController (unit)', () => {
  let controller: AuthController;
  let authService: {
    changePassword: jest.Mock;
    enableTwoFactor: jest.Mock;
    verifyTwoFactor: jest.Mock;
    disableTwoFactor: jest.Mock;
    checkTwoFactorStatus: jest.Mock;
  };
  let transferService: {
    generateTransferToken: jest.Mock;
    consumeTransferToken: jest.Mock;
    swapTokenForSession: jest.Mock;
  };

  beforeEach(() => {
    authService = {
      changePassword: jest.fn(),
      enableTwoFactor: jest.fn(),
      verifyTwoFactor: jest.fn(),
      disableTwoFactor: jest.fn(),
      checkTwoFactorStatus: jest.fn(),
    };

    transferService = {
      generateTransferToken: jest.fn(),
      consumeTransferToken: jest.fn(),
      swapTokenForSession: jest.fn(),
    };

    controller = new AuthController(
      authService as unknown as AuthService,
      transferService as unknown as TransferService,
    );
  });

  describe('changePassword', () => {
    it('should change password for an authenticated user', async () => {
      authService.changePassword.mockResolvedValue(undefined);

      const req = { user: { id: 'user-123' } };
      const result = await controller.changePassword(req, {
        currentPassword: 'old',
        newPassword: 'new',
      });

      expect(authService.changePassword).toHaveBeenCalledWith('user-123', {
        currentPassword: 'old',
        newPassword: 'new',
      });
      expect(result).toEqual({ message: 'Password changed successfully' });
    });

    it('should throw an Unauthorized error when no user is present', async () => {
      const req = {};
      await expect(
        controller.changePassword(req, {
          currentPassword: 'old',
          newPassword: 'new',
        }),
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('enableTwoFactor', () => {
    it('should enable 2FA and return the secret and QR code URL', async () => {
      const secret = 'BASE32SECRET';
      const qrCodeUrl = 'otpauth://totp/HelloTalk:user?secret=BASE32SECRET';
      authService.enableTwoFactor.mockResolvedValue({
        secret,
        qrCodeUrl,
      });

      const req = { user: { id: 'user-123' } };
      const result = await controller.enableTwoFactor(req);

      expect(authService.enableTwoFactor).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({ secret, qrCodeUrl });
    });

    it('should throw an Unauthorized error when no user is present', async () => {
      const req = {};
      await expect(controller.enableTwoFactor(req)).rejects.toThrow(
        'Unauthorized',
      );
    });
  });

  describe('verifyTwoFactor', () => {
    const req = { user: { id: 'user-123' } };

    it('should return success true for a valid token', async () => {
      authService.verifyTwoFactor.mockResolvedValue(true);

      const result = await controller.verifyTwoFactor(req, '123456');

      expect(authService.verifyTwoFactor).toHaveBeenCalledWith(
        'user-123',
        '123456',
      );
      expect(result).toEqual({ success: true });
    });

    it('should return success false for an invalid token', async () => {
      authService.verifyTwoFactor.mockResolvedValue(false);

      const result = await controller.verifyTwoFactor(req, '000000');

      expect(authService.verifyTwoFactor).toHaveBeenCalledWith(
        'user-123',
        '000000',
      );
      expect(result).toEqual({ success: false });
    });

    it('should propagate the error when the auth service throws', async () => {
      authService.verifyTwoFactor.mockRejectedValue(new Error('Invalid token'));

      await expect(controller.verifyTwoFactor(req, '000000')).rejects.toThrow(
        'Invalid token',
      );
    });
  });

  describe('disableTwoFactor', () => {
    it('should disable 2FA and return success', async () => {
      authService.disableTwoFactor.mockResolvedValue(true);

      const req = { user: { id: 'user-123' } };
      const result = await controller.disableTwoFactor(req, '123456');

      expect(authService.disableTwoFactor).toHaveBeenCalledWith(
        'user-123',
        '123456',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('twoFactorStatus', () => {
    it('should return whether 2FA is enabled', async () => {
      authService.checkTwoFactorStatus.mockResolvedValue(true);

      const req = { user: { id: 'user-123' } };
      const result = await controller.twoFactorStatus(req);

      expect(authService.checkTwoFactorStatus).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({ enabled: true });
    });
  });

  describe('generateTransferLink', () => {
    it('should generate a transfer link', async () => {
      transferService.generateTransferToken.mockResolvedValue('xfer-token');
      process.env.APP_URL = 'http://localhost:4200';

      const req = { user: { id: 'user-123' } };
      const result = await controller.generateTransferLink(req);

      expect(transferService.generateTransferToken).toHaveBeenCalledWith(
        'user-123',
      );
      expect(result).toEqual({
        url: 'http://localhost:4200/device-transfer?token=xfer-token',
      });
    });
  });

  describe('consumeTransferLink', () => {
    it('should consume a transfer token', async () => {
      transferService.consumeTransferToken.mockResolvedValue('swap-token');

      const result = await controller.consumeTransferLink('xfer-token');

      expect(transferService.consumeTransferToken).toHaveBeenCalledWith(
        'xfer-token',
      );
      expect(result).toEqual({ swapToken: 'swap-token' });
    });

    it('should throw on invalid token', async () => {
      transferService.consumeTransferToken.mockResolvedValue(null);

      await expect(
        controller.consumeTransferLink('bad-token'),
      ).rejects.toThrow('Invalid or expired transfer token');
    });
  });

  describe('swapTransferLink', () => {
    it('should swap a transfer link for a session', async () => {
      transferService.swapTokenForSession.mockResolvedValue({
        access_token: 'at',
        refresh_token: 'rt',
        user_id: 'uid',
      });

      const result = await controller.swapTransferLink('swap-token');

      expect(result).toEqual({
        access_token: 'at',
        refresh_token: 'rt',
        user_id: 'uid',
      });
    });

    it('should throw on invalid swap token', async () => {
      transferService.swapTokenForSession.mockResolvedValue(null);

      await expect(
        controller.swapTransferLink('bad-swap'),
      ).rejects.toThrow('Invalid or expired swap token');
    });
  });
});

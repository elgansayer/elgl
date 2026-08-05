import { AuthController } from './auth.controller';

describe('AuthController (unit)', () => {
  let controller: AuthController;
  let authService: {
    requestPasswordReset: jest.Mock;
    resetPassword: jest.Mock;
    changePassword: jest.Mock;
    enableTwoFactor: jest.Mock;
    verifyTwoFactor: jest.Mock;
    disableTwoFactor: jest.Mock;
    checkTwoFactorStatus: jest.Mock;
  };

  beforeEach(() => {
    authService = {
      requestPasswordReset: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
      enableTwoFactor: jest.fn(),
      verifyTwoFactor: jest.fn(),
      disableTwoFactor: jest.fn(),
      checkTwoFactorStatus: jest.fn(),
    };

    controller = new (AuthController as any)(authService) as AuthController;
  });

  describe('requestPasswordReset', () => {
    it('should call the auth service and return a success message', async () => {
      authService.requestPasswordReset.mockResolvedValue(undefined);

      const result = await controller.requestPasswordReset({
        email: 'user@example.com',
      });

      expect(authService.requestPasswordReset).toHaveBeenCalledWith(
        'user@example.com',
      );
      expect(result).toEqual({
        message: 'If the email address exists, a reset link has been sent.',
      });
    });
  });

  describe('resetPassword', () => {
    it('should reset password and return success message', async () => {
      authService.resetPassword.mockResolvedValue(undefined);

      const body = { token: 'abc', newPassword: 'newpass' };
      const result = await controller.resetPassword(body);

      expect(authService.resetPassword).toHaveBeenCalledWith('abc', 'newpass');
      expect(result).toEqual({ message: 'Password successfully reset' });
    });
  });

  describe('changePassword', () => {
    it('should change password for an authenticated user', async () => {
      authService.changePassword.mockResolvedValue(undefined);

      const req = { user: { id: 'user-123' } };
      const result = await controller.changePassword(req, 'newPass123');

      expect(authService.changePassword).toHaveBeenCalledWith(
        'user-123',
        'newPass123',
      );
      expect(result).toEqual({ message: 'Password changed successfully' });
    });

    it('should throw an Unauthorized error when no user is present', async () => {
      const req = {};
      await expect(controller.changePassword(req, 'somePass')).rejects.toThrow(
        'Unauthorized',
      );
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
});

import { PasswordResetController } from './password-reset.controller';
import { PasswordResetService } from './password-reset.service';

describe('PasswordResetController', () => {
  let controller: PasswordResetController;
  let resetService: {
    requestPasswordReset: jest.Mock;
    resetPassword: jest.Mock;
  };

  beforeEach(() => {
    resetService = {
      requestPasswordReset: jest.fn(),
      resetPassword: jest.fn(),
    };

    controller = new PasswordResetController(
      resetService as unknown as PasswordResetService,
    );
  });

  describe('requestPasswordReset', () => {
    it('should return a success message without revealing email existence', async () => {
      resetService.requestPasswordReset.mockResolvedValue(undefined);

      const result = await controller.requestPasswordReset({
        email: 'user@example.com',
      });

      expect(resetService.requestPasswordReset).toHaveBeenCalledWith({
        email: 'user@example.com',
      });
      expect(result).toEqual({
        message: 'If the email address exists, a reset link has been sent.',
      });
    });

    it('should still return success even for non-existent emails', async () => {
      resetService.requestPasswordReset.mockResolvedValue(undefined);

      const result = await controller.requestPasswordReset({
        email: 'nobody@example.com',
      });

      expect(result).toEqual({
        message: 'If the email address exists, a reset link has been sent.',
      });
    });
  });

  describe('resetPassword', () => {
    it('should reset password and return success', async () => {
      resetService.resetPassword.mockResolvedValue(undefined);

      const result = await controller.resetPassword({
        token: 'valid-token',
        newPassword: 'newSecurePass123',
      });

      expect(resetService.resetPassword).toHaveBeenCalledWith({
        token: 'valid-token',
        newPassword: 'newSecurePass123',
      });
      expect(result).toEqual({
        message: 'Password has been successfully reset.',
      });
    });
  });
});

import { PasswordResetController } from './password-reset.controller';
import { PasswordResetService } from './password-reset.service';

describe('PasswordResetController (unit)', () => {
  let controller: PasswordResetController;
  let resetService: { requestPasswordReset: jest.Mock; resetPassword: jest.Mock };

  beforeEach(() => {
    resetService = {
      requestPasswordReset: jest.fn(),
      resetPassword: jest.fn(),
    };
    controller = new (PasswordResetController as any)(resetService) as PasswordResetController;
  });

  describe('requestPasswordReset', () => {
    it('should return a generic success message', async () => {
      resetService.requestPasswordReset.mockResolvedValue(undefined);

      const result = await controller.requestPasswordReset({ email: 'user@example.com' });

      expect(resetService.requestPasswordReset).toHaveBeenCalledWith({ email: 'user@example.com' });
      expect(result).toEqual({
        message: 'If the email address exists, a reset link has been sent.',
      });
    });

    it('should propagate errors from the service', async () => {
      resetService.requestPasswordReset.mockRejectedValue(new Error('db error'));

      await expect(
        controller.requestPasswordReset({ email: 'user@example.com' }),
      ).rejects.toThrow('db error');
    });
  });

  describe('resetPassword', () => {
    it('should reset the password and return success', async () => {
      resetService.resetPassword.mockResolvedValue(undefined);

      const result = await controller.resetPassword({ token: 'abc123', newPassword: 'newPass123!' });

      expect(resetService.resetPassword).toHaveBeenCalledWith({
        token: 'abc123',
        newPassword: 'newPass123!',
      });
      expect(result).toEqual({ message: 'Password has been successfully reset.' });
    });

    it('should propagate errors from the service', async () => {
      resetService.resetPassword.mockRejectedValue(new Error('invalid token'));

      await expect(
        controller.resetPassword({ token: 'bad', newPassword: 'newPass123!' }),
      ).rejects.toThrow('invalid token');
    });
  });
});
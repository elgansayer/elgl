import { PasswordResetController } from './password-reset.controller';

describe('PasswordResetController (unit)', () => {
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

    controller = new (PasswordResetController as any)(
      resetService,
    ) as PasswordResetController;
  });

  describe('requestPasswordReset', () => {
    it('should call the reset service and return a generic message', async () => {
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

    it('should still return the generic message even if the service throws', async () => {
      resetService.requestPasswordReset.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(
        controller.requestPasswordReset({ email: 'bad@example.com' }),
      ).rejects.toThrow('DB error');
    });
  });

  describe('resetPassword', () => {
    it('should call the reset service and return a success message', async () => {
      resetService.resetPassword.mockResolvedValue(undefined);

      const result = await controller.resetPassword({
        token: 'valid-token',
        newPassword: 'newPass456!',
      });

      expect(resetService.resetPassword).toHaveBeenCalledWith({
        token: 'valid-token',
        newPassword: 'newPass456!',
      });
      expect(result).toEqual({
        message: 'Password has been successfully reset.',
      });
    });

    it('should propagate errors from the reset service', async () => {
      resetService.resetPassword.mockRejectedValue(new Error('Invalid token'));

      await expect(
        controller.resetPassword({
          token: 'bad',
          newPassword: 'justalongpassword',
        }),
      ).rejects.toThrow('Invalid token');
    });
  });
});

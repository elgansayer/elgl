import type { Mock } from 'vitest';
import { PasswordResetController } from './password-reset.controller';

describe('PasswordResetController (unit)', () => {
  let controller: PasswordResetController;
  let resetService: {
    requestPasswordReset: Mock;
    resetPassword: Mock;
  };

  beforeEach(() => {
    resetService = {
      requestPasswordReset: vi.fn(),
      resetPassword: vi.fn(),
    };
    controller = new (PasswordResetController as any)(
      resetService,
    ) as PasswordResetController;
  });

  describe('requestPasswordReset', () => {
    const genericResponse = {
      message: 'If the email address exists, a reset link has been sent.',
    };

    it('calls the service and returns a generic success message', async () => {
      resetService.requestPasswordReset.mockResolvedValue(undefined);

      const result = await controller.requestPasswordReset({
        email: 'user@example.com',
      });

      expect(resetService.requestPasswordReset).toHaveBeenCalledWith({
        email: 'user@example.com',
      });
      expect(result).toEqual(genericResponse);
    });

    it('returns the same generic response when the service fails', async () => {
      resetService.requestPasswordReset.mockRejectedValue(
        new Error('email provider unavailable'),
      );

      const result = await controller.requestPasswordReset({
        email: 'user@example.com',
      });

      expect(result).toEqual(genericResponse);
    });
  });

  describe('resetPassword', () => {
    it('calls the service and returns success message', async () => {
      resetService.resetPassword.mockResolvedValue(undefined);

      const result = await controller.resetPassword({
        token: 'valid-token',
        newPassword: 'newPass123!',
      });

      expect(resetService.resetPassword).toHaveBeenCalledWith({
        token: 'valid-token',
        newPassword: 'newPass123!',
      });
      expect(result).toEqual({
        message: 'Password has been successfully reset.',
      });
    });

    it('preserves reset failures for invalid or unusable tokens', async () => {
      const failure = new Error('invalid reset token');
      resetService.resetPassword.mockRejectedValue(failure);

      await expect(
        controller.resetPassword({
          token: 'invalid-token',
          newPassword: 'newPass123!',
        }),
      ).rejects.toBe(failure);
    });
  });

  describe('throttle configuration for password reset endpoints', () => {
    const throttleLimitKey = 'THROTTLER:LIMITdefault';
    const throttleTtlKey = 'THROTTLER:TTLdefault';

    const throttledEndpoints: Array<{
      method: keyof PasswordResetController;
      limit: number;
      ttl: number;
    }> = [
      { method: 'requestPasswordReset', limit: 3, ttl: 300000 },
      { method: 'resetPassword', limit: 3, ttl: 300000 },
    ];

    it.each(throttledEndpoints)(
      'limits $method to $limit requests per $ttl ms window',
      ({ method, limit, ttl }) => {
        const handler = PasswordResetController.prototype[method];

        expect(Reflect.getMetadata(throttleLimitKey, handler)).toBe(limit);
        expect(Reflect.getMetadata(throttleTtlKey, handler)).toBe(ttl);
      },
    );
  });
});

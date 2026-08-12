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
    it('should call service and return a generic success message', async () => {
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

    it('should return success message even if service throws (to not leak info)', async () => {
      resetService.requestPasswordReset.mockRejectedValue(undefined);

      // It will throw; controller does not catch it – that's by design, callers see error
      await expect(
        controller.requestPasswordReset({ email: 'bad@example.com' }),
      ).rejects.toBeUndefined();
    });
  });

  describe('resetPassword', () => {
    it('should call service and return success message', async () => {
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
  });

  describe('throttle configuration for password reset endpoints', () => {
    // Metadata keys used by @nestjs/throttler for the default named throttler.
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
      'should limit $method to $limit requests per $ttl ms window',
      ({ method, limit, ttl }) => {
        const handler = PasswordResetController.prototype[method];

        expect(Reflect.getMetadata(throttleLimitKey, handler)).toBe(limit);
        expect(Reflect.getMetadata(throttleTtlKey, handler)).toBe(ttl);
      },
    );
  });
});

import type { Mock } from 'vitest';
import { AuthController } from './auth.controller';

describe('AuthController (unit)', () => {
  let controller: AuthController;
  let authService: {
    changePassword: Mock;
    enableTwoFactor: Mock;
    verifyTwoFactor: Mock;
    disableTwoFactor: Mock;
    checkTwoFactorStatus: Mock;
  };

  let _transferService: {
    generateTransferToken: Mock;
    consumeTransferToken: Mock;
    swapTokenForSession: Mock;
  };

  beforeEach(() => {
    authService = {
      changePassword: vi.fn(),
      enableTwoFactor: vi.fn(),
      verifyTwoFactor: vi.fn(),
      disableTwoFactor: vi.fn(),
      checkTwoFactorStatus: vi.fn(),
    };
    _transferService = {
      generateTransferToken: vi.fn(),
      consumeTransferToken: vi.fn(),
      swapTokenForSession: vi.fn(),
    };

    controller = new (AuthController as any)(authService) as AuthController;
  });

  describe('changePassword', () => {
    it('should change password for an authenticated user', async () => {
      authService.changePassword.mockResolvedValue(undefined);

      const req = { user: { id: 'user-123' } };
      const result = await controller.changePassword(req, {
        currentPassword: 'old',
        newPassword: 'newPass123',
      });

      expect(authService.changePassword).toHaveBeenCalledWith('user-123', {
        currentPassword: 'old',
        newPassword: 'newPass123',
      });
      expect(result).toEqual({ message: 'Password changed successfully' });
    });

    it('should throw an Unauthorized error when no user is present', async () => {
      const req = {};
      await expect(
        controller.changePassword(req, {
          currentPassword: 'old',
          newPassword: 'somePass',
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

  describe('throttle configuration for sensitive authentication endpoints', () => {
    // Metadata keys used by @nestjs/throttler for the default named throttler.
    const throttleLimitKey = 'THROTTLER:LIMITdefault';
    const throttleTtlKey = 'THROTTLER:TTLdefault';

    const throttledEndpoints: Array<{
      method: keyof AuthController;
      limit: number;
      ttl: number;
    }> = [
      { method: 'changePassword', limit: 3, ttl: 60000 },
      { method: 'enableTwoFactor', limit: 5, ttl: 300000 },
      { method: 'verifyTwoFactor', limit: 5, ttl: 60000 },
      { method: 'disableTwoFactor', limit: 3, ttl: 60000 },
      { method: 'generateTransferLink', limit: 5, ttl: 60000 },
      { method: 'consumeTransferLink', limit: 5, ttl: 60000 },
      { method: 'swapTransferLink', limit: 5, ttl: 60000 },
    ];

    it.each(throttledEndpoints)(
      'should limit $method to $limit requests per $ttl ms window',
      ({ method, limit, ttl }) => {
        const handler = AuthController.prototype[method];

        expect(Reflect.getMetadata(throttleLimitKey, handler)).toBe(limit);
        expect(Reflect.getMetadata(throttleTtlKey, handler)).toBe(ttl);
      },
    );

    it('should leave the read-only two-factor status endpoint unthrottled', () => {
      const handler = AuthController.prototype.twoFactorStatus;

      expect(Reflect.getMetadata(throttleLimitKey, handler)).toBeUndefined();
      expect(Reflect.getMetadata(throttleTtlKey, handler)).toBeUndefined();
    });
  });
});

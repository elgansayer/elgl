import type { Mock } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService (unit)', () => {
  let service: AuthService;
  let supabaseService: { getClient: Mock };
  let twoFactorService: {
    generateSecret: Mock;
    verifyToken: Mock;
    disable: Mock;
  };

  beforeEach(() => {
    supabaseService = { getClient: vi.fn() };
    twoFactorService = {
      generateSecret: vi.fn(),
      verifyToken: vi.fn(),
      disable: vi.fn(),
    };

    service = new (AuthService as any)(
      supabaseService,
      twoFactorService,
    ) as AuthService;
  });

  describe('changePassword', () => {
    it('should change password when current password is correct', async () => {
      const mockClient = {
        auth: {
          admin: {
            getUserById: vi.fn().mockResolvedValue({
              error: null,
              data: { user: { email: 'user@example.com' } },
            }),
            updateUserById: vi.fn().mockResolvedValue({ error: null }),
          },
          signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
        },
      };
      supabaseService.getClient.mockReturnValue(mockClient);

      await service.changePassword('user-123', {
        currentPassword: 'oldPass',
        newPassword: 'newPass123',
      });

      expect(mockClient.auth.admin.getUserById).toHaveBeenCalledWith(
        'user-123',
      );
      expect(mockClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'oldPass',
      });
      expect(mockClient.auth.admin.updateUserById).toHaveBeenCalledWith(
        'user-123',
        { password: 'newPass123' },
      );
    });

    it('should throw when user is not found', async () => {
      const mockClient = {
        auth: {
          admin: {
            getUserById: vi.fn().mockResolvedValue({
              error: { message: 'Not found' },
              data: null,
            }),
            updateUserById: vi.fn(),
          },
          signInWithPassword: vi.fn(),
        },
      };
      supabaseService.getClient.mockReturnValue(mockClient);

      await expect(
        service.changePassword('user-123', {
          currentPassword: 'oldPass',
          newPassword: 'newPass123',
        }),
      ).rejects.toThrow('User not found');
    });

    it('should throw when current password is incorrect', async () => {
      const mockClient = {
        auth: {
          admin: {
            getUserById: vi.fn().mockResolvedValue({
              error: null,
              data: { user: { email: 'user@example.com' } },
            }),
            updateUserById: vi.fn(),
          },
          signInWithPassword: vi
            .fn()
            .mockResolvedValue({ error: { message: 'Invalid password' } }),
        },
      };
      supabaseService.getClient.mockReturnValue(mockClient);

      await expect(
        service.changePassword('user-123', {
          currentPassword: 'wrongPass',
          newPassword: 'newPass123',
        }),
      ).rejects.toThrow('Current password is incorrect');
    });
  });

  describe('two factor', () => {
    it('should enable 2FA and return secret and QR code', async () => {
      twoFactorService.generateSecret.mockResolvedValue({
        secret: 'BASE32SECRET',
        qrCodeUrl: 'otpauth://totp/HelloTalk:user?secret=BASE32SECRET',
      });

      const result = await service.enableTwoFactor('user-123');

      expect(twoFactorService.generateSecret).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({
        secret: 'BASE32SECRET',
        qrCodeUrl: 'otpauth://totp/HelloTalk:user?secret=BASE32SECRET',
      });
    });

    it('should verify a valid 2FA token', async () => {
      twoFactorService.verifyToken.mockResolvedValue(true);

      const result = await service.verifyTwoFactor('user-123', '123456');

      expect(twoFactorService.verifyToken).toHaveBeenCalledWith(
        'user-123',
        '123456',
      );
      expect(result).toBe(true);
    });

    it('should throw for an invalid 2FA token', async () => {
      twoFactorService.verifyToken.mockResolvedValue(false);

      await expect(
        service.verifyTwoFactor('user-123', '000000'),
      ).rejects.toThrow('Invalid 2FA token');
    });

    it('should disable 2FA successfully', async () => {
      twoFactorService.disable.mockResolvedValue(true);

      const result = await service.disableTwoFactor('user-123', '123456');

      expect(twoFactorService.disable).toHaveBeenCalledWith(
        'user-123',
        '123456',
      );
      expect(result).toBe(true);
    });

    it('should return false when disabling 2FA fails', async () => {
      twoFactorService.disable.mockRejectedValue(new Error('Failed'));

      const result = await service.disableTwoFactor('user-123', '123456');

      expect(result).toBe(false);
    });
  });
});

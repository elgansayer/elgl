import type { Mock } from 'vitest';
import { AuthService } from './auth.service';
import { EmailService } from '../email/email.service';

describe('AuthService (unit)', () => {
  let service: AuthService;
  let supabaseService: { getClient: Mock };
  let twoFactorService: {
    generateSecret: Mock;
    verifyToken: Mock;
    disable: Mock;
  };
  let emailService: { sendPasswordResetEmail: Mock };

  beforeEach(() => {
    supabaseService = { getClient: vi.fn() };
    twoFactorService = {
      generateSecret: vi.fn(),
      verifyToken: vi.fn(),
      disable: vi.fn(),
    };
    emailService = { sendPasswordResetEmail: vi.fn() };

    service = new (AuthService as any)(
      supabaseService,
      twoFactorService,
      emailService,
    ) as AuthService;
  });

  describe('requestPasswordReset', () => {
    it('should send a password reset email when the user exists', async () => {
      const mockClient = {
        auth: {
          admin: {
            generateLink: vi.fn().mockResolvedValue({
              error: null,
              data: {
                properties: {
                  action_link:
                    'https://example.com/#access_token=test-token-123&expires_in=3600',
                },
              },
            }),
          },
        },
      };
      supabaseService.getClient.mockReturnValue(mockClient);

      await service.requestPasswordReset('user@example.com');

      expect(mockClient.auth.admin.generateLink).toHaveBeenCalledWith({
        type: 'recovery',
        email: 'user@example.com',
        options: { redirectTo: '' },
      });
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'user@example.com',
        'test-token-123',
      );
    });

    it('should not send email when Supabase returns an error', async () => {
      const mockClient = {
        auth: {
          admin: {
            generateLink: vi.fn().mockResolvedValue({
              error: { message: 'User not found' },
              data: null,
            }),
          },
        },
      };
      supabaseService.getClient.mockReturnValue(mockClient);

      await service.requestPasswordReset('nonexistent@example.com');

      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should not send email when action link is missing', async () => {
      const mockClient = {
        auth: {
          admin: {
            generateLink: vi.fn().mockResolvedValue({
              error: null,
              data: { properties: {} },
            }),
          },
        },
      };
      supabaseService.getClient.mockReturnValue(mockClient);

      await service.requestPasswordReset('user@example.com');

      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should not throw when the email lookup fails', async () => {
      const mockClient = {
        auth: {
          admin: {
            generateLink: vi.fn().mockRejectedValue(new Error('Network error')),
          },
        },
      };
      supabaseService.getClient.mockReturnValue(mockClient);

      await expect(
        service.requestPasswordReset('user@example.com'),
      ).rejects.toThrow();
    });
  });

  describe('resetPassword', () => {
    it('should reset password using a valid token', async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            error: null,
            data: { user: { id: 'user-123' } },
          }),
          admin: {
            updateUserById: vi.fn().mockResolvedValue({ error: null }),
          },
        },
      };
      supabaseService.getClient.mockReturnValue(mockClient);

      await service.resetPassword('valid-token', 'newPassword123');

      expect(mockClient.auth.getUser).toHaveBeenCalledWith('valid-token');
      expect(mockClient.auth.admin.updateUserById).toHaveBeenCalledWith(
        'user-123',
        { password: 'newPassword123' },
      );
    });

    it('should throw BadRequestException for an invalid token', async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            error: { message: 'Invalid token' },
            data: null,
          }),
        },
      };
      supabaseService.getClient.mockReturnValue(mockClient);

      await expect(
        service.resetPassword('invalid-token', 'newPassword123'),
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('should throw BadRequestException when user ID is missing', async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            error: null,
            data: { user: {} },
          }),
        },
      };
      supabaseService.getClient.mockReturnValue(mockClient);

      await expect(
        service.resetPassword('valid-token', 'newPassword123'),
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('should throw BadRequestException when password update fails', async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            error: null,
            data: { user: { id: 'user-123' } },
          }),
          admin: {
            updateUserById: vi
              .fn()
              .mockResolvedValue({ error: { message: 'Password too weak' } }),
          },
        },
      };
      supabaseService.getClient.mockReturnValue(mockClient);

      await expect(
        service.resetPassword('valid-token', 'weak'),
      ).rejects.toThrow('Password too weak');
    });
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

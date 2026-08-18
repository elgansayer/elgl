import { Test } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PasswordResetService } from './password-reset.service';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../email/email.service';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let mockSupabaseClient: {
    from: ReturnType<typeof vi.fn>;
    auth: {
      admin: {
        listUsers: ReturnType<typeof vi.fn>;
        updateUserById: ReturnType<typeof vi.fn>;
      };
    };
  };
  let mockEmailService: {
    sendPasswordResetEmail: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockEmailService = {
      sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    };

    mockSupabaseClient = {
      from: vi.fn(),
      auth: {
        admin: {
          listUsers: vi.fn(),
          updateUserById: vi.fn(),
        },
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: ConfigService, useValue: { get: vi.fn() } },
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = moduleRef.get(PasswordResetService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('requestPasswordReset', () => {
    it('silently returns when no user is found', async () => {
      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });

      await service.requestPasswordReset({ email: 'nobody@example.com' });

      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('creates a reset token and sends email for a valid user', async () => {
      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: { users: [{ id: 'user-abc', email: 'user@example.com' }] },
        error: null,
      });

      const insertChain = {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockSupabaseClient.from.mockReturnValue(insertChain);

      await service.requestPasswordReset({ email: 'USER@example.com' });

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-abc',
          used: false,
        }),
      );
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'USER@example.com',
        expect.any(String),
      );
      const token = mockEmailService.sendPasswordResetEmail.mock.calls[0][1];
      expect(token).toHaveLength(64);
    });

    it('fails internally when account lookup fails', async () => {
      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: null,
        error: { message: 'auth unavailable' },
      });

      await expect(
        service.requestPasswordReset({ email: 'user@example.com' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('throws when token persistence fails', async () => {
      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: { users: [{ id: 'user-abc', email: 'user@example.com' }] },
        error: null,
      });
      const insertChain = {
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'insert failed' },
        }),
      };
      mockSupabaseClient.from.mockReturnValue(insertChain);

      await expect(
        service.requestPasswordReset({ email: 'user@example.com' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('invalidates an undelivered token when email dispatch fails', async () => {
      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: { users: [{ id: 'user-abc', email: 'user@example.com' }] },
        error: null,
      });
      const insertChain = {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      const invalidateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockSupabaseClient.from
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(invalidateChain);
      mockEmailService.sendPasswordResetEmail.mockRejectedValue(
        new Error('mail unavailable'),
      );

      await expect(
        service.requestPasswordReset({ email: 'user@example.com' }),
      ).rejects.toThrow(BadRequestException);

      expect(invalidateChain.update).toHaveBeenCalledWith({ used: true });
      expect(invalidateChain.eq).toHaveBeenCalledWith(
        'token',
        expect.any(String),
      );
    });
  });

  describe('resetPassword', () => {
    const createClaimChain = (
      result: { data: { user_id: string } | null; error: unknown },
    ) => ({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue(result),
    });

    it('rejects an invalid or expired token before changing a password', async () => {
      const claimChain = createClaimChain({ data: null, error: null });
      mockSupabaseClient.from.mockReturnValue(claimChain);

      await expect(
        service.resetPassword({
          token: 'invalid-token',
          newPassword: 'newPass123!',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(claimChain.update).toHaveBeenCalledWith({ used: true });
      expect(claimChain.eq).toHaveBeenCalledWith('used', false);
      expect(claimChain.gt).toHaveBeenCalledWith(
        'expires_at',
        expect.any(String),
      );
      expect(mockSupabaseClient.auth.admin.updateUserById).not.toHaveBeenCalled();
    });

    it('atomically claims a valid token before changing the password', async () => {
      const claimChain = createClaimChain({
        data: { user_id: 'user-abc' },
        error: null,
      });
      mockSupabaseClient.from.mockReturnValue(claimChain);
      mockSupabaseClient.auth.admin.updateUserById.mockResolvedValue({
        data: null,
        error: null,
      });

      await service.resetPassword({
        token: 'valid-token',
        newPassword: 'newPass123!',
      });

      expect(claimChain.update).toHaveBeenCalledWith({ used: true });
      expect(claimChain.eq).toHaveBeenCalledWith('token', 'valid-token');
      expect(claimChain.eq).toHaveBeenCalledWith('used', false);
      expect(claimChain.select).toHaveBeenCalledWith('user_id');
      expect(mockSupabaseClient.auth.admin.updateUserById).toHaveBeenCalledWith(
        'user-abc',
        { password: 'newPass123!' },
      );
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(1);
    });

    it('allows only one password change when the same token is retried', async () => {
      const claimChain = createClaimChain({
        data: { user_id: 'user-abc' },
        error: null,
      });
      claimChain.maybeSingle
        .mockResolvedValueOnce({ data: { user_id: 'user-abc' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });
      mockSupabaseClient.from.mockReturnValue(claimChain);
      mockSupabaseClient.auth.admin.updateUserById.mockResolvedValue({
        data: null,
        error: null,
      });

      await service.resetPassword({
        token: 'single-use-token',
        newPassword: 'firstPass123!',
      });
      await expect(
        service.resetPassword({
          token: 'single-use-token',
          newPassword: 'secondPass123!',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockSupabaseClient.auth.admin.updateUserById).toHaveBeenCalledTimes(1);
      expect(mockSupabaseClient.auth.admin.updateUserById).toHaveBeenCalledWith(
        'user-abc',
        { password: 'firstPass123!' },
      );
    });

    it('rejects the request when the token claim fails', async () => {
      const claimChain = createClaimChain({
        data: null,
        error: { message: 'database unavailable' },
      });
      mockSupabaseClient.from.mockReturnValue(claimChain);

      await expect(
        service.resetPassword({
          token: 'valid-token',
          newPassword: 'newPass123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockSupabaseClient.auth.admin.updateUserById).not.toHaveBeenCalled();
    });

    it('throws when password update fails after the token is claimed', async () => {
      const claimChain = createClaimChain({
        data: { user_id: 'user-abc' },
        error: null,
      });
      mockSupabaseClient.from.mockReturnValue(claimChain);
      mockSupabaseClient.auth.admin.updateUserById.mockResolvedValue({
        data: null,
        error: { message: 'auth update failed' },
      });

      await expect(
        service.resetPassword({
          token: 'valid-token',
          newPassword: 'newPass123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

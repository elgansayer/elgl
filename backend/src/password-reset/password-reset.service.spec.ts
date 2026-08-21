import { Test } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
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

  const createExistingTokenInvalidationChain = () => ({
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  });

  const createInsertChain = (error: unknown = null) => ({
    insert: vi.fn().mockResolvedValue({ data: null, error }),
  });

  const prepareSuccessfulIssue = () => {
    const invalidationChain = createExistingTokenInvalidationChain();
    const insertChain = createInsertChain();
    mockSupabaseClient.from
      .mockReturnValueOnce(invalidationChain)
      .mockReturnValueOnce(insertChain);
    return { invalidationChain, insertChain };
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

    it('paginates beyond the first 1,000 auth users', async () => {
      const firstPageUsers = Array.from({ length: 1000 }, (_, index) => ({
        id: `user-${index}`,
        email: `user-${index}@example.com`,
      }));
      mockSupabaseClient.auth.admin.listUsers
        .mockResolvedValueOnce({
          data: { users: firstPageUsers },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { users: [{ id: 'target-user', email: 'target@example.com' }] },
          error: null,
        });
      prepareSuccessfulIssue();

      await service.requestPasswordReset({ email: 'target@example.com' });

      expect(mockSupabaseClient.auth.admin.listUsers).toHaveBeenNthCalledWith(
        1,
        {
          page: 1,
          perPage: 1000,
        },
      );
      expect(mockSupabaseClient.auth.admin.listUsers).toHaveBeenNthCalledWith(
        2,
        {
          page: 2,
          perPage: 1000,
        },
      );
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    });

    it('stores only a SHA-256 digest while emailing the raw reset token', async () => {
      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: { users: [{ id: 'user-abc', email: 'user@example.com' }] },
        error: null,
      });
      const { invalidationChain, insertChain } = prepareSuccessfulIssue();

      await service.requestPasswordReset({ email: 'USER@example.com' });

      expect(invalidationChain.update).toHaveBeenCalledWith({ used: true });
      expect(invalidationChain.eq).toHaveBeenCalledWith('user_id', 'user-abc');
      expect(invalidationChain.eq).toHaveBeenCalledWith('used', false);

      const rawToken = mockEmailService.sendPasswordResetEmail.mock.calls[0][1];
      const storedToken = insertChain.insert.mock.calls[0][0].token;
      const expectedHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      expect(rawToken).toHaveLength(64);
      expect(storedToken).toBe(expectedHash);
      expect(storedToken).not.toBe(rawToken);
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'USER@example.com',
        rawToken,
      );
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

    it('does not issue a new token when prior-token invalidation fails', async () => {
      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: { users: [{ id: 'user-abc', email: 'user@example.com' }] },
        error: null,
      });
      const invalidationChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn(),
      };
      invalidationChain.eq
        .mockReturnValueOnce(invalidationChain)
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'update failed' },
        });
      mockSupabaseClient.from.mockReturnValue(invalidationChain);

      await expect(
        service.requestPasswordReset({ email: 'user@example.com' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('throws when token persistence fails', async () => {
      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: { users: [{ id: 'user-abc', email: 'user@example.com' }] },
        error: null,
      });
      const invalidationChain = createExistingTokenInvalidationChain();
      const insertChain = createInsertChain({ message: 'insert failed' });
      mockSupabaseClient.from
        .mockReturnValueOnce(invalidationChain)
        .mockReturnValueOnce(insertChain);

      await expect(
        service.requestPasswordReset({ email: 'user@example.com' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('invalidates an undelivered token by its stored digest', async () => {
      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: { users: [{ id: 'user-abc', email: 'user@example.com' }] },
        error: null,
      });
      const { insertChain } = prepareSuccessfulIssue();
      const deliveryInvalidationChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockSupabaseClient.from.mockReturnValueOnce(deliveryInvalidationChain);
      mockEmailService.sendPasswordResetEmail.mockRejectedValue(
        new Error('mail unavailable'),
      );

      await expect(
        service.requestPasswordReset({ email: 'user@example.com' }),
      ).rejects.toThrow(BadRequestException);

      const storedToken = insertChain.insert.mock.calls[0][0].token;
      expect(deliveryInvalidationChain.update).toHaveBeenCalledWith({
        used: true,
      });
      expect(deliveryInvalidationChain.eq).toHaveBeenCalledWith(
        'token',
        storedToken,
      );
    });
  });

  describe('resetPassword', () => {
    const createClaimChain = (result: {
      data: { user_id: string } | null;
      error: unknown;
    }) => ({
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
      expect(
        mockSupabaseClient.auth.admin.updateUserById,
      ).not.toHaveBeenCalled();
    });

    it('claims the SHA-256 digest before changing the password', async () => {
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

      const expectedHash = crypto
        .createHash('sha256')
        .update('valid-token')
        .digest('hex');
      expect(claimChain.eq).toHaveBeenCalledWith('token', expectedHash);
      expect(claimChain.eq).not.toHaveBeenCalledWith('token', 'valid-token');
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

      expect(
        mockSupabaseClient.auth.admin.updateUserById,
      ).toHaveBeenCalledTimes(1);
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
      expect(
        mockSupabaseClient.auth.admin.updateUserById,
      ).not.toHaveBeenCalled();
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

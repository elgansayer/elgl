import { Test, TestingModule } from '@nestjs/testing';
import { PasswordResetService } from './password-reset.service';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../email/email.service';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let mockSupabaseClient: {
    from: jest.Mock;
    auth: {
      admin: {
        listUsers: jest.Mock;
        updateUserById: jest.Mock;
      };
    };
  };
  let mockEmailService: { sendPasswordResetEmail: jest.Mock };

  function createMockQB() {
    const qb: Record<string, jest.Mock> = {};
    const methods = ['select', 'eq', 'single', 'insert', 'update'];
    for (const m of methods) {
      qb[m] = jest.fn().mockReturnValue(qb);
    }
    return qb;
  }

  beforeEach(async () => {
    const supabaseAdmin = {
      listUsers: jest
        .fn()
        .mockResolvedValue({ data: { users: [] }, error: null }),
      updateUserById: jest.fn(),
    };

    mockSupabaseClient = {
      from: jest.fn(),
      auth: { admin: supabaseAdmin },
    };

    mockEmailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: ConfigService, useValue: { get: jest.fn() } },
        {
          provide: SupabaseService,
          useValue: { getClient: () => mockSupabaseClient },
        },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<PasswordResetService>(PasswordResetService);
  });

  describe('requestPasswordReset', () => {
    it('should silently return when no user is found', async () => {
      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });

      await service.requestPasswordReset({ email: 'nobody@example.com' });

      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should create a reset token and send email for a valid user', async () => {
      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: {
          users: [
            { id: 'user-abc', email: 'user@example.com' },
          ],
        },
        error: null,
      });

      const insertChain = createMockQB();
      insertChain.insert = jest.fn().mockResolvedValue({ error: null });
      mockSupabaseClient.from.mockReturnValue(insertChain);

      await service.requestPasswordReset({ email: 'user@example.com' });

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-abc',
          used: false,
        }),
      );
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.any(String),
      );
      const token = mockEmailService.sendPasswordResetEmail.mock.calls[0][1];
      expect(token).toHaveLength(64);
    });

    it('should throw BadRequestException when token insert fails', async () => {
      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: {
          users: [
            { id: 'user-abc', email: 'user@example.com' },
          ],
        },
        error: null,
      });

      const insertChain = createMockQB();
      insertChain.insert = jest
        .fn()
        .mockResolvedValue({ error: new Error('insert failed') });
      mockSupabaseClient.from.mockReturnValue(insertChain);

      await expect(
        service.requestPasswordReset({ email: 'user@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resetPassword', () => {
    it('should throw for invalid token', async () => {
      const selectChain = createMockQB();
      selectChain.single = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });
      mockSupabaseClient.from.mockReturnValue(selectChain);

      await expect(
        service.resetPassword({
          token: 'bad-token',
          newPassword: 'newpass123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for expired token', async () => {
      const pastDate = new Date(Date.now() - 10000);
      const selectChain = createMockQB();
      selectChain.single = jest.fn().mockResolvedValue({
        data: { user_id: 'user-1', expires_at: pastDate.toISOString() },
        error: null,
      });
      mockSupabaseClient.from.mockReturnValue(selectChain);

      await expect(
        service.resetPassword({
          token: 'expired-token',
          newPassword: 'newpass123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should update password and mark token used for valid request', async () => {
      const futureDate = new Date(Date.now() + 3600000);

      const selectChain = createMockQB();
      selectChain.single = jest.fn().mockResolvedValue({
        data: { user_id: 'user-abc', expires_at: futureDate.toISOString() },
        error: null,
      });

      const updateChain = createMockQB();
      updateChain.eq = jest.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(updateChain);

      mockSupabaseClient.auth.admin.updateUserById.mockResolvedValue({
        error: null,
      });

      await service.resetPassword({
        token: 'valid-token',
        newPassword: 'newPass123!',
      });

      expect(mockSupabaseClient.auth.admin.updateUserById).toHaveBeenCalledWith(
        'user-abc',
        { password: 'newPass123!' },
      );
      expect(updateChain.eq).toHaveBeenCalledWith('token', 'valid-token');
    });

    it('should throw BadRequestException when password update fails', async () => {
      const future = new Date(Date.now() + 30 * 60 * 1000);

      const selectChain = createMockQB();
      selectChain.single = jest.fn().mockResolvedValue({
        data: { user_id: 'user-abc', expires_at: future.toISOString() },
        error: null,
      });
      mockSupabaseClient.from.mockReturnValue(selectChain);

      mockSupabaseClient.auth.admin.updateUserById.mockResolvedValue({
        error: new Error('auth update failed'),
      });

      await expect(
        service.resetPassword({
          token: 'valid-token',
          newPassword: 'newpass123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

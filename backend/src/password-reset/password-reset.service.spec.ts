import { Test, TestingModule } from '@nestjs/testing';
import { PasswordResetService } from './password-reset.service';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../email/email.service';
import { UnauthorizedException } from '@nestjs/common';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let mockSupabase: {
    from: jest.Mock;
    auth: { admin: { updateUserById: jest.Mock } };
  };
  let mockEmailService: { sendPasswordResetEmail: jest.Mock };

  function _createMockQB() {
    const qb: Record<string, jest.Mock> = {};
    const methods = ['select', 'eq', 'single', 'insert', 'update'];
    for (const m of methods) {
      qb[m] = jest.fn().mockReturnValue(qb);
    }
    return qb;
  }

  beforeEach(() => {
    supabaseAdmin = {
      getUserByEmail: jest.fn().mockRejectedValue(new Error('Not available')),
      listUsers: jest
        .fn()
        .mockResolvedValue({ data: { users: [] }, error: null }),
      updateUserById: jest.fn(),
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
          useValue: { getClient: () => mockSupabase },
        },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<PasswordResetService>(PasswordResetService);
  });

  describe('requestPasswordReset', () => {
    it('should silently return when no user is found', async () => {
      supabaseAdmin.getUserByEmail.mockRejectedValue(
        new Error('Not available'),
      );
      supabaseAdmin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });

      await service.requestPasswordReset({ email: 'nobody@example.com' });

      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should send reset email when user is found', async () => {
      mockQB.eq
        .mockReturnValueOnce({ data: [{ id: 'user-1' }], error: null })
        .mockReturnValueOnce({ error: null });

      await service.requestPasswordReset({ email: 'user@example.com' });

      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should create a reset token and send email for a valid user', async () => {
      const findChain = createChain();
      supabaseClient.from = jest.fn().mockReturnValue(findChain);
      findChain.select = jest.fn().mockReturnValue(findChain);
      findChain.eq = jest
        .fn()
        .mockResolvedValue({ data: [{ id: 'user-abc' }], error: null });

      const insertChain = createChain();
      // Override from for the insert call
      supabaseClient.from = jest
        .fn()
        .mockReturnValueOnce(findChain) // select
        .mockReturnValueOnce(insertChain); // insert

      findChain.select = jest.fn().mockReturnValue(findChain);
      findChain.eq = jest
        .fn()
        .mockResolvedValue({ data: [{ id: 'user-abc' }], error: null });

      insertChain.insert = jest.fn().mockResolvedValue({ error: null });

      await service.requestPasswordReset({ email: 'user@example.com' });

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-abc',
          used: false,
        }),
      );
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.any(String),
      );
      const token = emailService.sendPasswordResetEmail.mock.calls[0][1];
      expect(token).toHaveLength(64);
    });

    it('should fall back to listUsers and send reset email', async () => {
      supabaseAdmin.getUserByEmail.mockRejectedValue(
        new Error('Not available'),
      );
      supabaseAdmin.listUsers.mockResolvedValue({
        data: {
          users: [
            { id: 'user-fallback', email: 'user@example.com' },
            { id: 'other', email: 'other@example.com' },
          ],
        },
        error: null,
      });

      const insertChain = createChain();
      supabaseClient.from = jest.fn().mockReturnValue(insertChain);
      insertChain.insert = jest.fn().mockResolvedValue({ error: null });

      await service.requestPasswordReset({ email: 'user@example.com' });

      expect(supabaseAdmin.listUsers).toHaveBeenCalled();
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-fallback' }),
      );
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.any(String),
      );
    });

    it('should throw BadRequestException when token insert fails', async () => {
      const findChain = createChain();
      supabaseClient.from = jest.fn().mockReturnValue(findChain);
      findChain.select = jest.fn().mockReturnValue(findChain);
      findChain.eq = jest
        .fn()
        .mockResolvedValue({ data: [{ id: 'user-abc' }], error: null });

      const insertChain = createChain();
      supabaseClient.from = jest
        .fn()
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(insertChain);

      findChain.select = jest.fn().mockReturnValue(findChain);
      findChain.eq = jest
        .fn()
        .mockResolvedValue({ data: [{ id: 'user-abc' }], error: null });

      insertChain.insert = jest
        .fn()
        .mockResolvedValue({ error: new Error('insert failed') });

      await expect(
        service.requestPasswordReset({ email: 'user@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resetPassword', () => {
    it('should throw for invalid token', async () => {
      mockQB.single.mockReturnValueOnce({
        data: null,
        error: { message: 'not found' },
      });

      await expect(
        service.resetPassword({
          token: 'bad-token',
          newPassword: 'newpass123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for expired token', async () => {
      const pastDate = new Date(Date.now() - 10000);
      mockQB.single.mockReturnValueOnce({
        data: { user_id: 'user-1', expires_at: pastDate.toISOString() },
        error: null,
      });

      await expect(
        service.resetPassword({
          token: 'expired-token',
          newPassword: 'newpass123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should update password and mark token used for valid request', async () => {
      const futureDate = new Date(Date.now() + 3600000);

      mockQB.single.mockReturnValueOnce({
        data: { user_id: 'user-1', expires_at: futureDate.toISOString() },
        error: null,
      });

      supabaseAdmin.updateUserById = jest
        .fn()
        .mockResolvedValue({ error: null });

      const updateChain = createChain();
      supabaseClient.from = jest
        .fn()
        .mockReturnValueOnce(findChain) // select
        .mockReturnValueOnce(updateChain); // update

      findChain.select = jest.fn().mockReturnValue(findChain);
      findChain.eq = jest.fn().mockReturnValue(findChain);
      findChain.single = jest.fn().mockResolvedValue({
        data: { user_id: 'user-abc', expires_at: future.toISOString() },
        error: null,
      });

      updateChain.update = jest.fn().mockReturnValue(updateChain);
      updateChain.eq = jest.fn().mockResolvedValue({ error: null });

      await service.resetPassword({
        token: 'valid-token',
        newPassword: 'newPass123!',
      });

      expect(supabaseAdmin.updateUserById).toHaveBeenCalledWith('user-abc', {
        password: 'newPass123!',
      });
      expect(updateChain.eq).toHaveBeenCalledWith('token', 'valid-token');
    });

    it('should throw BadRequestException when password update fails', async () => {
      const future = new Date(Date.now() + 30 * 60 * 1000);
      const chain = createChain();
      supabaseClient.from = jest.fn().mockReturnValue(chain);
      chain.select = jest.fn().mockReturnValue(chain);
      chain.eq = jest.fn().mockReturnValue(chain);
      chain.single = jest.fn().mockResolvedValue({
        data: { user_id: 'user-abc', expires_at: future.toISOString() },
        error: null,
      });

      supabaseAdmin.updateUserById = jest.fn().mockResolvedValue({
        error: new Error('auth update failed'),
      });

      await expect(
        service.resetPassword({
          token: 'valid-token',
          newPassword: 'newpass123',
        }),
      ).resolves.toBeUndefined();

      expect(mockSupabase.auth.admin.updateUserById).toHaveBeenCalledWith(
        'user-1',
        {
          password: 'newpass123',
        },
      );
    });
  });
});

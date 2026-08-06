import { PasswordResetService } from './password-reset.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

describe('PasswordResetService (unit)', () => {
  let service: PasswordResetService;
  let configService: { get: jest.Mock };
  let supabaseService: { getClient: jest.Mock };
  let emailService: { sendPasswordResetEmail: jest.Mock };
  let supabaseAdmin: {
    getUserByEmail: jest.Mock;
    listUsers: jest.Mock;
    updateUserById: jest.Mock;
  };
  let supabaseClient: {
    from: jest.Mock;
    auth: { admin: typeof supabaseAdmin };
  };

  function createChain() {
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
    };
  }

  beforeEach(() => {
    supabaseAdmin = {
      getUserByEmail: jest.fn().mockRejectedValue(new Error('Not available')),
      listUsers: jest
        .fn()
        .mockResolvedValue({ data: { users: [] }, error: null }),
      updateUserById: jest.fn(),
    };

    supabaseClient = {
      from: jest.fn().mockReturnThis(),
      auth: {
        admin: supabaseAdmin,
      },
    };

    configService = { get: jest.fn() };
    supabaseService = { getClient: jest.fn().mockReturnValue(supabaseClient) };
    emailService = { sendPasswordResetEmail: jest.fn() };

    service = new (PasswordResetService as any)(
      configService,
      supabaseService,
      emailService,
    ) as PasswordResetService;
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

    it('should silently return on database error', async () => {
      const chain = createChain();
      supabaseClient.from = jest.fn().mockReturnValue(chain);
      chain.select = jest.fn().mockReturnValue(chain);
      chain.eq = jest
        .fn()
        .mockResolvedValue({ data: null, error: new Error('db error') });

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
    it('should throw UnauthorizedException when token is not found', async () => {
      const chain = createChain();
      supabaseClient.from = jest.fn().mockReturnValue(chain);
      chain.select = jest.fn().mockReturnValue(chain);
      chain.eq = jest.fn().mockReturnValue(chain);
      chain.single = jest
        .fn()
        .mockResolvedValue({ data: null, error: new Error('not found') });

      await expect(
        service.resetPassword({
          token: 'bad-token',
          newPassword: 'newPass123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when token is expired', async () => {
      const past = new Date(Date.now() - 100 * 60 * 1000);
      const chain = createChain();
      supabaseClient.from = jest.fn().mockReturnValue(chain);
      chain.select = jest.fn().mockReturnValue(chain);
      chain.eq = jest.fn().mockReturnValue(chain);
      chain.single = jest.fn().mockResolvedValue({
        data: { user_id: 'user-abc', expires_at: past.toISOString() },
        error: null,
      });

      await expect(
        service.resetPassword({
          token: 'expired-token',
          newPassword: 'newPass123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should update password and mark token as used', async () => {
      const future = new Date(Date.now() + 30 * 60 * 1000);
      const findChain = createChain();
      supabaseClient.from = jest.fn().mockReturnValue(findChain);
      findChain.select = jest.fn().mockReturnValue(findChain);
      findChain.eq = jest.fn().mockReturnValue(findChain);
      findChain.single = jest.fn().mockResolvedValue({
        data: { user_id: 'user-abc', expires_at: future.toISOString() },
        error: null,
      });

      supabaseClient.auth.admin.updateUserById = jest
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
          newPassword: 'newPass123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

function createChain() {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
  };
}

import { Test, TestingModule } from '@nestjs/testing';
import { PasswordResetService } from './password-reset.service';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../email/email.service';
import { UnauthorizedException } from '@nestjs/common';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let mockSupabase: { from: jest.Mock; auth: { admin: { updateUserById: jest.Mock } } };
  let mockEmailService: { sendPasswordResetEmail: jest.Mock };

  function createMockQB() {
    const qb: Record<string, jest.Mock> = {};
    const methods = ['select', 'eq', 'single', 'insert', 'update'];
    for (const m of methods) {
      qb[m] = jest.fn().mockReturnValue(qb);
    }
    return qb;
  }

  let mockQB: ReturnType<typeof createMockQB>;

  beforeEach(async () => {
    mockQB = createMockQB();

    mockSupabase = {
      from: jest.fn().mockReturnValue(mockQB),
      auth: { admin: { updateUserById: jest.fn() } },
    };

    mockEmailService = { sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: SupabaseService, useValue: { getClient: () => mockSupabase } },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<PasswordResetService>(PasswordResetService);
  });

  describe('requestPasswordReset', () => {
    it('should not reveal whether the email exists when no user found', async () => {
      mockQB.eq.mockReturnValueOnce({ data: [], error: null });
      await expect(service.requestPasswordReset({ email: 'no@user.com' })).resolves.toBeUndefined();
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should send reset email when user is found', async () => {
      mockQB.eq
        .mockReturnValueOnce({ data: [{ id: 'user-1' }], error: null })
        .mockReturnValueOnce({ error: null });

      await service.requestPasswordReset({ email: 'user@test.com' });
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith('user@test.com', expect.any(String));
    });
  });

  describe('resetPassword', () => {
    it('should throw for invalid token', async () => {
      mockQB.single.mockReturnValueOnce({ data: null, error: { message: 'not found' } });

      await expect(
        service.resetPassword({ token: 'bad-token', newPassword: 'newpass123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for expired token', async () => {
      const pastDate = new Date(Date.now() - 10000);
      mockQB.single.mockReturnValueOnce({
        data: { user_id: 'user-1', expires_at: pastDate.toISOString() },
        error: null,
      });

      await expect(
        service.resetPassword({ token: 'expired-token', newPassword: 'newpass123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should update password and mark token used for valid request', async () => {
      const futureDate = new Date(Date.now() + 3600000);

      mockQB.single.mockReturnValueOnce({
        data: { user_id: 'user-1', expires_at: futureDate.toISOString() },
        error: null,
      });

      mockSupabase.auth.admin.updateUserById.mockResolvedValueOnce({ error: null });

      await expect(
        service.resetPassword({ token: 'valid-token', newPassword: 'newpass123' }),
      ).resolves.toBeUndefined();

      expect(mockSupabase.auth.admin.updateUserById).toHaveBeenCalledWith('user-1', {
        password: 'newpass123',
      });
    });
  });
});